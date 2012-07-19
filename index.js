var util = require('util');
var errors = require('./lib/errors.js');
var Range = require('./lib/range.js');
var Buffer = require('./lib/buffer.js');
var bufproto = Buffer.prototype;

function BitWriter(input, endianness) {
  if (!(this instanceof BitWriter))
    return new BitWriter(input, endianness);
  this.initialize.apply(this, arguments)
}
util.inherits(BitWriter, Buffer);

BitWriter.getSize = function (n) {
  var range = BitWriter.RANGE;
  if (range[8].test(n)) return 8;
  if (range[16].test(n)) return 16;
  if (range[32].test(n)) return 32;
}

BitWriter.prototype.initialize = function initialize(input, endianness) {
  this._pos = 0;
  this._endianness = endianness || 'BE';
  this._generateMethodTable();

  if (typeof input === 'string') {
    this.setupBuffer(input.length);
    this.write(input);
    return this;
  }

  if (util.isArray(input)) {
    var inputs = input.map(function (input) {
      var obj = {};
      if (typeof input === 'number') {
        obj.value = input;
        obj.width = BitWriter.getSize(input);
      } else {
        obj = input
      }
      return obj;
    });

    var length = inputs.reduce(function (length, obj) {
      return length + (obj.width / 8);
    }, 0);

    this.setupBuffer(length);

    inputs.forEach(function (obj) {
      this.writeInt.call(this, obj)
    }.bind(this));

    return this;
  }

  // probably a number representing a length at this point
  this.setupBuffer(input)
};

BitWriter.prototype.setupBuffer = function (length, opts) {
  opts = opts || { fill: true };

  var buf = this._buffer = Buffer(length);
  if (opts.fill) buf.fill(0);

  // this give us compatibility with a bunch of buffer methods
  this.parent = buf.parent;
  this.length = buf.length;
  this.offset = buf.offset;
  this.pool = buf.pool;
  this._makeArrayLike();

  return this;
};

/**
 * Get the buffer.
 *
 * @return {Buffer}
 */

BitWriter.prototype.out = function out() {
  return this._buffer
};

/**
 * Figure out what the best way to write to the buffer is and dispatch
 * to the appropriate method.
 *
 * @param {Mixed} data
 * @see BitWriter#writeInt
 * @see BitWriter#writeString
 * @see BitWriter#writeRaw
 */

BitWriter.prototype.write = function write(data) {
  if (util.isArray(data) || Buffer.isBuffer(data))
    return this.writeRaw.apply(this, arguments)

  var value = data;
  if (data.value)
    value = data.value;

  if (typeof value === 'string')
    return this.writeString.apply(this, arguments);

  return this.writeInt.apply(this, arguments);
};

/**
 * Write an integer to the buffer.
 *
 * @param {Integer} integer
 * @param {Object} opts
 *   - `size`: specify integer size
 *   - `width`: alias for size
 * @throws {TypeError} when `integer` is an unconvertible string.
 * @throws {RangeError} when `size` is invalid or number is too big
 * @throws {DispatchError} when it can't find a method to dispatch to
 * @throws {OverflowError} when there aren't enough bytes left to write int
 * @return {this}
 *
 * @see BitWriter.INT_SIZES
 */

BitWriter.prototype.writeInt = function writeInt(integer, opts) {
  var type;
  var range = BitWriter.RANGE[32];
  var validSizes = BitWriter.INT_SIZES;

  if (typeof integer === 'object' && integer.value)
    opts = integer, integer = opts.value

  if (typeof integer === 'string') {
    if (!integer.match(/^\d+$/))
      throw errors.type(integer, 'integer');
    integer = parseInt(integer, 10);
  }

  if (!range.test(integer))
    throw errors.range(integer, range);

  if (opts && (opts.size || opts.width)) {
    var width = opts.size || opts.width;
    if (!~validSizes.indexOf(width))
      throw errors.size(width, validSizes);

    var methodlist = this._methods.bySize;
    type = methodlist[integer > 0 ? 'unsigned' : 'signed'][width];
  }
  else {
    type = this._methods.filter(function (m) {
      if (m.test(integer)) return m;
    })[0];
  }

  if (!type)
    throw errors.dispatch(integer, opts);

  var remaining = this.remaining();
  if (type.length > remaining)
    throw errors.overflow(integer, type.length, remaining);

  type.method.call(this._buffer, integer, this.position());
  this.move(type.length);
  return this;
};

BitWriter.prototype.writeString = function writeString(string, opts) {
  if (!opts) opts = {};
  if (!('null' in opts))
    opts.null = true;

  var buf = Buffer(string);
  var len = buf.length;

  // when given a size we want to write exactly that many bytes and either
  // truncate the string or pad the rest with nulls.
  if (opts.size) {
    var size = opts.size;
    var nulls;

    if (len > size)
      return this.write(buf.slice(0, size));

    nulls = Buffer(size - len);
    nulls.fill(0);
    return this.write(Buffer.concat([buf, nulls]));
  }

  if (buf.length > this.remaining())
    throw errors.overflow(string, buf.length, this.remaining());

  // we only want to write the null byte if the user hasn't said not to
  // and if there's room left in the main buffer
  this.write(buf);
  if (opts.null !== false && this.remaining() > 0)
    this.write(BitWriter.NULL_BYTE);

  return this;
};


/**
 * Write raw bytes to the buffer.
 *
 * @param {Array-like} arry
 * @param {Object} opts
 *   - `safe`: skip type/range checks
 */

BitWriter.prototype.writeRaw = function writeRaw(arry, opts) {
  if (Buffer.isBuffer(arry)) return this._copyBuffer(arry);

  // don't bother to type or range check if we know the string is safe.
  // this will save us a few cycles, but can be risky if they array isn't
  // actually checked beforehand.
  if (opts && opts.safe === true) {
    for (var n = 0; n < arry.length; n++)
      this.write8(arry[n]);
    return this;
  }

  // we need to make sure we're not trying to write weird objects or we'll
  // get an AssertionError from buffer. we also ensure that the value is
  // within the boundaries of an eight bit integer or we'll get unexpected
  // results down the line somewhere.
  var eightBitRange = BitWriter.RANGE[8];
  for (var n = 0; n < arry.length; n++) {
    if (typeof arry[n] !== 'number')
      throw errors.arrayType(arry, n);
    if (!eightBitRange.test(arry[n]))
      throw errors.range(arry[n], eightBitRange);
  }

  return this.writeRaw(arry, { safe: true });
};

/**
 * Show how many bytes are left to write in the buffer
 *
 * @return {Integer}
 */
BitWriter.prototype.remaining = function () {
  return this.length - this._pos;
};

/**
 * Attach bound write methods to another object.
 *
 * @param {Object} obj
 */

BitWriter.prototype.attach = function (obj, key) {
  var proto = BitWriter.prototype;
  Object.keys(proto).filter(function (m) {
    return m.match(/^write/);
  }).forEach(function (method) {
    var bound = this[method].bind(this);
    obj[method] = bound;
  }.bind(this));
  if (key) obj[key] = this;
  return obj;
};

/** convenience */
BitWriter.prototype.write8 = function (value) {
  return this.writeInt(value, {size: 8});
};
BitWriter.prototype.write16 = function (value) {
  return this.writeInt(value, {size: 16});
};
BitWriter.prototype.write32 = function (value) {
  return this.writeInt(value, {size: 32});
};
BitWriter.prototype.full = function () {
  return this.remaining() === 0;
};
BitWriter.prototype.position = function (p) {
  var range = Range(0, this.length);
  if (typeof p !== 'undefined') {
    if (typeof p !== 'number')
      throw errors.type(p, 'Number');
    if (!range.test(p) || isNaN(p))
      throw errors.range(p, range);
    this._pos = p;
    return this;
  }
  return this._pos;
};
BitWriter.prototype.reset = function () {
  this._buffer.fill(0);
  this.position(0);
  return this;
};
BitWriter.prototype.move = function (amount) {
  if (typeof amount !== 'number')
    throw errors.type(amount, 'Number');
  var pos = this.position();
  return this.position(pos + amount);
};

BitWriter.prototype._copyBuffer = function copyBuffer(buf) {
  buf.copy(this, this.position());
  this.move(buf.length);
  return this;
};


BitWriter.prototype._generateMethodTable = function generateMethodTable() {
  var e = this._endianness;
  var unsigned = BitWriter.UNSIGNED_RANGE;
  var signed = BitWriter.SIGNED_RANGE;
  this._methods = [
    { method: bufproto['writeUInt8'],
      length: 1,
      test: unsigned[8].test
    }, {
      method: bufproto['writeUInt16' + e],
      length: 2,
      test: unsigned[16].test
    }, {
      method: bufproto['writeUInt32' + e],
      length: 4,
      test: unsigned[32].test
    }, {
      method: bufproto['writeInt8'],
      length: 1,
      test: signed[8].test
    }, {
      method: bufproto['writeInt16' + e],
      length: 2,
      test: signed[16].test
    }, {
      method: bufproto['writeInt32' + e],
      length: 4,
      test: signed[32].test,
    }
  ];
  this._methods.bySize = {
    unsigned: {
      '8': this._methods[0],
      '16': this._methods[1],
      '32': this._methods[2],
    },
    signed: {
      '8': this._methods[3],
      '16': this._methods[4],
      '32': this._methods[5],
    }
  }
};

BitWriter.prototype._makeArrayLike = function makeArrayLike() {
  var eightBitRange = BitWriter.RANGE[8];
  var len = this.length;
  for (var n = 0; n < this.length; n++) {
    (function (n) {
      Object.defineProperty(this, n, {
        get: function () { return this.get(n) },
        set: function (v) {
          if (!eightBitRange.test(v))
            throw errors.range(v, eightBitRange);
          return this.set(n, v);
        },
        enumerable: true,
        configurable: true
      });
    }).bind(this)(n);
  }
};
BitWriter.RANGE = {
  '8': Range(-0x80, 0xff),
  '16': Range(-0x8000, 0xffff),
  '32': Range(-0x80000000, 0xffffffff)
};
BitWriter.UNSIGNED_RANGE = {
  '8': Range(0, 0xff),
  '16': Range(0, 0xffff),
  '32': Range(0, 0xffffffff)
};
BitWriter.SIGNED_RANGE = {
  '8': Range(-0x80, 0x7f),
  '16': Range(-0x8000, 0x7fff),
  '32': Range(-0x80000000, 0x7fffffff)
};

BitWriter.INT_SIZES = [8, 16, 32];
BitWriter.NULL_BYTE = Buffer([0x00]);

module.exports = BitWriter;

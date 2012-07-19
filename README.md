# bitwriter [![Build Status](https://secure.travis-ci.org/brianloveswords/bitwriter.png?branch=master)](http://travis-ci.org/brianloveswords/bitwriter)

A better interface for writing bytes to a buffer with a priority on safety.

## Install

```bash
$ npm install bitwriter
```

## Tests

```bash
$ npm test
```

## Usage

```js
var BitWriter = require('bitwriter');
```

# API
`BitWriter` Inherits from `Buffer`, so you get all of the buffer methods
(`fill`, `slice`, `copy`, etc) as well. You can also use `Buffer.concat`
with instances.

## BitWriter(*length, [endianness='BE']*)

```js
var buf = BitWriter(4); 
buf.inspect(); // <BitWriter 00 00 00 00>

// or if you need a little endian writer
buf = BitWriter(4, 'LE');
```
## BitWriter(*array, [endianness='BE']*)
**@see** `BitWriter#writeInt`<br>
***

You can also specify an array of integers or objects representing
integers. Uses `BitWriter#writeInt` internally.

```js
var buf = BitWriter([ 1, 2, 64738, 23 ]);
buf.out(); // <Buffer 01 02 fc e2 17>
  
var obuf = BitWriter([ 1, 2, 64738, { value: 23, width: 16 } ]);
obuf.out(); // <Buffer 01 02 fc e2 00 17>
```

## BitWriter#write(*data, [opts]*)
**@returns** `this`<br>
**@see** `BitWriter#writeInt`<br>
**@see** `BitWriter#writeString`<br>
**@see** `BitWriter#writeRaw`
***

Make some assumptions and does its best to figure out what type of data you're
writing and how large that data is, then delegates to one of the write methods below.

## BitWriter#out()
**@returns** `{Buffer}`<br>

Returns reference to internal buffer.


## BitWriter#writeRaw(*arraylike, [opts]*)
**@returns** `this`<br>
**@throws** `TypeError`<br>
**@throws** `RangeError`<br>
**@see** `BitWriter#write8`<br>
**@see** `Buffer#copy`
***
Takes an array-like object and iterates through it, writing raw bytes to
the buffer.

Arrays are type-checked to be byte arrays and range-checked for values between [0, 255]. 

Delegates to `Buffer#copy` if given a buffer, which skips type checks
and is generally way more efficient.

```js
var buf = BitWriter(8);
buf.write([0xff, 0xdd, 0xaa, 0xbb]); // <BitWriter ff dd aa bb 00 00 00 00>
buf.write(Buffer('helo')); // <BitWriter ff dd aa bb 68 65 6c 6f>
```

If `opts.safe` is `true`, will skip type checks which is a bit more efficient
since it will only iterate over the array once, but can be dangerous
with unknown data.
 
Throws `TypeError` if the array contains any non-numeric values.

Throws `RangeError` if any values are outside the eight bit range.


## BitWriter#writeString(*string, [opts]*)
**@returns** `this`<br>
**@throws** `OverflowError`
***

Writes a string to the buffer. By default, a single `0x00` will be added
after the string if there is room left in the buffer.

```js
var buf = BitWriter(7);
buf.write('hey'); // <BitWriter 68 65 79 00 00 00 00>
buf.write('sup'); // <BitWriter 68 65 79 00 73 75 70>
```

If you don't want to write a null byte, you can pass an `{ null: false }`
```js
var buf = BitWriter(6);
buf.write('hey', { null: false }); // <BitWriter 68 65 79 00 00 00 >
buf.write('sup'); // <BitWriter 68 65 79 73 75 70>
```

If you have a specific amount of bytes you need to fit a string into,
you can use `{ size: <int> }`. This will either truncate the string to
fit, or pad the right side with `0x00`.

```js
var buf = BitWriter(4);
buf.write('hey this string is way too long!', { size: 4 });
buf.inspect(); // <BitWriter 68 65 79 20>
```

Throws `OverflowError` if there are less than `string.length` bytes left
in the buffer.


## BitWriter#writeInt(*integer, [opts]*)
## BitWriter#writeInt(*opts*)
**@returns** `this`<br>
**@throws** `RangeError`<br>
**@throws** `TypeError`<br>
**@throws** `OverflowError`<br>
**@throws** `DispatchError`<br>
*** 
### Options
- `size`: specify integer size
- `width`: alias for size

Writes an integer to the buffer, testing against the maximum and minimum
values 8, 16 and 32 bit numbers, both signed and unsigned, to figure out
how best to store your bytes.

If a single object is passed, tries to find the integer value from `opts.value`.

**Unsigned integers**
```js
var buf = BitWriter(8);
buf.write(128); //<BitWriter 80 00 00 00 00 00 00 00>
```

**Signed integers**
```js
buf.write(-1); // <BitWriter 80 ff 00 00 00 00 00 00>
```

**16 bits**
```js
buf.write(61453); // <BitWriter 80 ff f0 0d 00 00 00 00>
```

**32 bits**
```js
buf.write(262254561); // <BitWriter 80 ff f0 0d 0f a1 af e1>
```
If you have a number that fits in 8 bytes but you need to store it in a larger
size, you can specify that:

```js
var buf = BitWriter(4);
buf.write(-128, { size: 32 }); // <BitWriter ff ff ff 80>
```

Returns `this` so you can chain a bunch of writes:

```js
var output = BitWriter(4);
output
  .write(0x01)
  .write(0x02)
  .write(0x03)
  .write(0x04); // <BitWriter 01 02 03 04>
```

Throws `TypeError` if it gets a string that is not completely composed
of digits.

Throws `RangeError` an invalid `size` option is given. Valid sizes can
be found in the constant `BitWriter.INT_SIZES` (currently
`[8, 16, 32]`).

Throws `RangeError` if the value is less than the minimum value of a
32 bit signed integer or the maximum value of a 32 bit unsigned
integer. These values can be found in `BitWriter.MAX_VALUE` and
`BitWriter.MIN_VALUE`

Throws `OverflowError` when attempting to write more bytes than are
available in the buffer.

Throws `DispatchError` if it can't figure out what to do with a value.


## BitWriter#write8(*integer*)
Convenience for `BitWriter#write(integer, { size: 8 })`

## BitWriter#write16(*integer*)
Convenience for `BitWriter#write(integer, { size: 16 })`

## BitWriter#write32(*integer*)
Convenience for `BitWriter#write(integer, { size: 32 })`

## BitWriter[*length-1*], BitWriter[*length-1*] = [-128, 255]
**@returns** `{Integer[0,255] | Undefined}`<br>
**@throws** `RangeError`
*** 
 
Exactly like array accessing a `Buffer` with one difference: this will
throw `RangeError` if the value is less than -128 or greater than 255

Accessing a position < 0 or > `length - 1` will return undefined.


## BitWriter#reset()
**@returns** `this`.
***
 
Resets the internal cursor to position 0 and fills the buffer with `0x00`.



## BitWriter#position()
**@returns** `{Integer}`
*** 
 
 Returns the position of the internal cursor


## BitWriter#position(*integer*)
**@returns** `this` <br>
**@throws** `RangeError`<br>
**@throws** `TypeError`
*** 
 
Sets the position of the internal cursor. Value be between [0, length-1]

Throws `RangeError` if position is out of bounds.

Throws `TypeError` if input is not a number.

## BitWriter#move(*integer*)
**@returns** `this` <br>
**@see** `BitWriter#position`

Move the cursor a relative amount from where it is. Uses `BitWriter#position` internally.

```js
var buf = BitWriter(4);
buf.write(0x3d);
buf.position(); // 1
buf.move(-1);
buf.position(); // 0
buf.move(+3)
buf.position(); // 3

buf.move(+10); // throw RangeError
```

## BitWriter#attach(*object, [key]*)
**@returns** `object` <br>
***

This attachs hard `this`-bound versions of the `write*` methods  to another object.

```js
var meta = BitWriter(16).attach({
  name: 'SomeThing',
  widgets: [],
}, 'data');

meta.write('widget co');
meta.write32(0xff);
meta.data.inspect(); // <BitWriter 77 69 64 67 65 74 20 63 6f 00 00 00 ff 00 00 00>
```

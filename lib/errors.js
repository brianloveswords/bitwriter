var util = require('util');
var errs = require('errs');

function overflowError(data, length, remaining) {
  return errs.create({
    name: 'OverflowError',
    message: 'Not enough space in the buffer left to write `' + data + '` (tried to write ' + length + ' bytes, only ' + remaining +  ' remaining.)',
    writeLength: length,
    remaining: remaining,
    amountOver: length - remaining,
  });
};

function sizeError(size, range) {
  return errs.create({
    name: 'RangeError',
    message: util.format('Given an invalid size for writing an int (given: %s, expects: %j)', size, range),
    sizeGiven: size,
  });
};

function rangeError(num, range) {
  return errs.create({
    name: 'RangeError',
    message: util.format('Value outside of the valid range %j (given: %d)', range, num),
    min: range.min,
    max: range.max,
    value: num,
  });
};

function dispatchError(data, opts) {
  return errs.create({
    name: 'DispatchError',
    message: util.format('Could not figure out how to dispatch (data: %j, opts: %j)', data, opts)
  });
};

function arrayTypeError(array, position) {
  return errs.create({
    name: 'TypeError',
    message: util.format('Trying to write array with non-numeric types (%j at position %d)', array[position], position),
    array: array,
    position: position,
    value: array[position]
  });
};

function typeError(value, type) {
  return errs.create({
    name: 'TypeError',
    message: util.format('Invalid type, got %s, expected %s', typeof value, type),
    value: value,
    valueType: typeof value,
    expectedType: type
  });
};

module.exports = {
  overflow: overflowError,
  size: sizeError,
  range: rangeError,
  type: typeError,
  arrayType: arrayTypeError,
  dispatch: dispatchError
};

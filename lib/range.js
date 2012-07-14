function Range(min, max) {
  if (!(this instanceof Range))
    return new Range(min, max);
  this.min = min;
  this.max = max;
  this.array = [min, max];
}
Range.prototype.test = function test(value) {
  return !(value < this.min || value > this.max);
};
Range.prototype.toJSON = function () {
  return '[' + this.array.join(', ') + ']';
};

module.exports = Range;
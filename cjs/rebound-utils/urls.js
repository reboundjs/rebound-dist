"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _qs = require("qs");

var _qs2 = _interopRequireDefault(_qs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var QS_STRINGIFY_OPTS = {
  allowDots: true,
  encode: false,
  delimiter: '&'
};

var QS_PARSE_OPTS = {
  allowDots: true,
  delimiter: /[;,&]/
};

exports.default = {
  query: {
    stringify: function stringify(str) {
      return _qs2.default.stringify(str, QS_STRINGIFY_OPTS);
    },
    parse: function parse(obj) {
      return _qs2.default.parse(obj, QS_PARSE_OPTS);
    }
  }
};
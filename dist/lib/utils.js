"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.walker = walker;

var _walk = require("walk");

var _walk2 = _interopRequireDefault(_walk);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function walker() {
    const w = _walk2.default.walk.apply(_walk2.default, arguments);

    w.end = () => new Promise((resolve, reject) => {
        w.on("error", reject);
        w.on("end", resolve);
    });

    return w;
}

// export
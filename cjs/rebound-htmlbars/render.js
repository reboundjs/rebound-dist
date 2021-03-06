"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = render;

var _reboundUtils = require("rebound-utils/rebound-utils");

var _hooks2 = require("rebound-htmlbars/hooks");

var _hooks3 = _interopRequireDefault(_hooks2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var RENDER_TIMEOUT;
var TO_RENDER = [];
var ENV_QUEUE = [];

// A convenience method to push only unique eleents in an array of objects to
// the TO_RENDER queue. If the element is a Lazy Value, it marks it as dirty in
// the process
var push = function push(arr) {
  var _this = this;

  var i,
      len = arr.length;
  this.added || (this.added = {});
  arr.forEach(function (item) {
    if (_this.added[item.cid]) {
      return;
    }
    _this.added[item.cid] = 1;
    if (item.isLazyValue) {
      item.makeDirty();
    }
    _this.push(item);
  });
};

function reslot(env) {

  // Fix for stupid Babel module importer
  // TODO: Fix this. This is dumb. Modules don't resolve in by time of this file's
  // execution because of the dependancy tree so babel doesn't get a chance to
  // interop the default value of these imports. We need to do this at runtime instead.
  var hooks = _hooks3.default.default || _hooks3.default;

  var outlet,
      slots = env.root.options && env.root.options[_reboundUtils.REBOUND_SYMBOL];

  if (!env.root || !slots) {
    return;
  }

  // Walk the dom, without traversing into other custom elements, and search for
  // `<content>` outlets to render templates into.
  (0, _reboundUtils.$)(env.root.el).walkTheDOM(function (el) {
    if (env.root.el === el) {
      return true;
    }
    if (el.tagName === 'CONTENT') {
      outlet = el;
    }
    if (el.tagName.indexOf('-') > -1) {
      return false;
    }
    return true;
  });

  // If a `<content>` outlet is present in component's template, and a template
  // is provided, render it into the outlet
  if (slots.templates.default && _.isElement(outlet) && !outlet.slotted) {
    outlet.slotted = true;
    (0, _reboundUtils.$)(outlet).empty();
    outlet.appendChild(hooks.buildRenderResult(slots.templates.default, slots.env, slots.scope, {}).fragment);
  }
}

// Called on animation frame. TO_RENDER is a list of lazy-values to notify.
// When notified, they mark themselves as dirty. Then, call revalidate on all
// dirty expressions for each environment we need to re-render. Use `while(queue.length)`
// to accomodate synchronous renders where the render queue callbacks may trigger
// nested calls of `renderCallback`.
function renderCallback() {

  while (TO_RENDER.length) {
    TO_RENDER.shift().notify();
  }

  TO_RENDER.added = {};

  while (ENV_QUEUE.length) {
    var env = ENV_QUEUE.shift();
    for (var key in env.revalidateQueue) {
      env.revalidateQueue[key].revalidate();
    }
    reslot(env);
  }
  ENV_QUEUE.added = {};
}

// Listens for `change` events and calls `trigger` with the correct values
function onChange(model, options) {
  trigger.call(this, 'change', model, model.changedAttributes());
}

// Listens for `reset` events and calls `trigger` with the correct values
function onReset(data, options) {
  trigger.call(this, 'reset', data, data.isModel ? data.changedAttributes() : { '@each': data }, options);
}

// Listens for `update` events and calls `trigger` with the correct values
function onUpdate(collection, options) {
  trigger.call(this, 'update', collection, { '@each': collection }, options);
}

function trigger(type, data, changed) {
  var options = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

  // If nothing has changed, exit.
  if (!data || !changed) {
    return void 0;
  }

  var basePath = data.__path();

  // If this event came from within a service, include the service key in the base path
  if (options.service) {
    basePath = options.service + '.' + basePath;
  }

  // For each changed key, walk down the data tree from the root to the data
  // element that triggered the event and add all relevent callbacks to this
  // object's TO_RENDER queue.
  basePath = basePath.replace(/\[[^\]]+\]/g, ".@each");
  var parts = _reboundUtils.$.splitPath(basePath);
  var context = [];

  while (1) {
    var pre = context.join('.').trim();
    var post = parts.join('.').trim();

    for (var key in changed) {
      var path = (post + (post && key && '.') + key).trim();
      for (var testPath in this.env.observers[pre]) {
        if (_reboundUtils.$.startsWith(testPath, path)) {
          push.call(TO_RENDER, this.env.observers[pre][testPath]);
          push.call(ENV_QUEUE, [this.env]);
        }
      }
    }
    if (parts.length === 0) {
      break;
    }
    context.push(parts.shift());
  }

  // If Rebound is loaded in a testing environment, call renderCallback syncronously
  // so that changes to the data reflect in the DOM immediately.
  // TODO: Make tests async so this is not required
  if (window.Rebound && window.Rebound.testing) {
    return renderCallback();
  }

  // Otherwise, queue our render callback to be called on the next animation frame,
  // after the current call stack has been exhausted.
  window.cancelAnimationFrame(RENDER_TIMEOUT);
  RENDER_TIMEOUT = window.requestAnimationFrame(renderCallback);
}

// A render function that will merge user provided helpers and hooks with our defaults
// and bind a method that re-renders dirty expressions on data change and executes
// other delegated listeners added by our hooks.
function render(el, template, data) {
  var options = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

  // Fix for stupid Babel module importer
  // TODO: Fix this. This is dumb. Modules don't resolve in by time of this file's
  // execution because of the dependancy tree so babel doesn't get a chance to
  // interop the default value of these imports. We need to do this at runtime instead.
  var hooks = _hooks3.default.default || _hooks3.default;

  // If no data is passed to render, exit with an error
  if (!data) {
    return console.error('No data passed to render function.');
  }

  // Every component's template is rendered using a unique Environment and Scope
  // If this component already has them, re-use the same objects – they contain
  // important state information. Otherwise, create fresh ones for it.
  var env = data.env || hooks.createFreshEnv();
  var scope = data.scope || hooks.createFreshScope();

  // Bind the component as the scope's main data object
  hooks.bindSelf(env, scope, data);

  // Add template specific hepers to env
  _.extend(env.helpers, options.helpers);

  // Save env and scope on component data to trigger lazy-value streams on data change
  data.env = env;
  data.scope = scope;

  // Save data on env to allow helpers / hooks access to component methods
  env.root = data;

  // Ensure we have a contextual element to pass to render
  options.contextualElement || (options.contextualElement = data.el || document.body);
  options.self = data;

  // If data is an eventable object, run the onChange helper on any change
  if (data.listenTo) {
    data.stopListening(null, null, onChange).stopListening(null, null, onReset).stopListening(null, null, onUpdate);
    data.listenTo(data, 'change', onChange).listenTo(data, 'reset', onReset).listenTo(data, 'update', onUpdate);
  }

  // If this is a real template, run it with our merged helpers and hooks
  // If there is no template, just return an empty fragment
  env.template = template ? hooks.buildRenderResult(template, env, scope, options) : { fragment: document.createDocumentFragment() };
  (0, _reboundUtils.$)(el).empty();
  el.appendChild(env.template.fragment);
  reslot(env);
  return el;
}
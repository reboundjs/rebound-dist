"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ComputedProperty = exports.Collection = exports.Model = undefined;

var _model = require("rebound-data/model");

var _model2 = _interopRequireDefault(_model);

var _collection = require("rebound-data/collection");

var _collection2 = _interopRequireDefault(_collection);

var _computedProperty = require("rebound-data/computed-property");

var _computedProperty2 = _interopRequireDefault(_computedProperty);

var _reboundUtils = require("rebound-utils/rebound-utils");

var _reboundUtils2 = _interopRequireDefault(_reboundUtils);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Rebound Data
// ----------------
// These are methods inherited by all Rebound data types: **Models**,
// **Collections** and **Computed Properties**. Controls tree ancestry
// tracking, deep event propagation and tree destruction.

var sharedMethods = {
  // When a change event propagates up the tree it modifies the path part of
  // `change:<path>` to reflect the fully qualified path relative to that object.
  // Ex: Would trigger `change:val`, `change:[0].val`, `change:arr[0].val` and `obj.arr[0].val`
  // on each parent as it is propagated up the tree.
  propagateEvent: function propagateEvent(type, model) {
    if (this.__parent__ === this || type === 'dirty') {
      return void 0;
    }
    if (type.indexOf('change:') === 0 && model.isModel) {
      if (this.isCollection && ~type.indexOf('change:[')) {
        return void 0;
      }
      var key,
          path = model.__path().replace(this.__parent__.__path(), '').replace(/^\./, ''),
          changed = model.changedAttributes();

      for (key in changed) {
        // TODO: Modifying arguments array is bad. change this
        arguments[0] = 'change:' + path + (path && '.') + key; // jshint ignore:line
        this.__parent__.trigger.apply(this.__parent__, arguments);
      }
      return void 0;
    }
    return this.__parent__.trigger.apply(this.__parent__, arguments);
  },

  // Set this data object's parent to `parent` and, as long as a data object is
  // not its own parent, propagate every event triggered on `this` up the tree.
  setParent: function setParent(parent) {
    if (this.__parent__) {
      this.off('all', this.propagateEvent);
    }
    this.__parent__ = parent;
    this._hasAncestry = true;
    if (parent !== this) {
      this.on('all', this.__parent__.propagateEvent);
    }
    return parent;
  },

  // Recursively set a data tree's root element starting with `this` to the deepest child.
  // TODO: I dont like this recursively setting elements root when one element's root changes. Fix this.
  setRoot: function setRoot(root) {
    var obj = this;
    obj.__root__ = root;
    var val = obj.models || obj.attributes || obj.cache;
    _.each(val, function (value, key) {
      if (value && value.isData) {
        value.setRoot(root);
      }
    });
    return root;
  },

  // Tests to see if `this` has a parent `obj`.
  hasParent: function hasParent(obj) {
    var tmp = this;
    while (tmp !== obj) {
      tmp = tmp.__parent__;
      if (_.isUndefined(tmp)) return false;
      if (tmp === obj) return true;
      if (tmp.__parent__ === tmp) return false;
    }
    return true;
  },

  // De-initializes a data tree starting with `this` and recursively calling `deinitialize()` on each child.
  deinitialize: function deinitialize() {
    var _this = this;

    // Undelegate Backbone Events from this data object
    if (this.undelegateEvents) {
      this.undelegateEvents();
    }
    if (this.stopListening) {
      this.stopListening();
    }
    if (this.off) {
      this.off();
    }
    if (this.unwire) {
      this.unwire();
    }

    // Destroy this data object's lineage
    delete this.__parent__;
    delete this.__root__;
    delete this.__path;

    // If there is a dom element associated with this data object, destroy all listeners associated with it.
    // Remove all event listeners from this dom element, recursively remove element lazyvalues,
    // and then remove the element referance itself.
    if (this.el) {
      _.each(this.el.__listeners, function (handler, eventType) {
        if (this.el.removeEventListener) {
          this.el.removeEventListener(eventType, handler, false);
        }
        if (this.el.detachEvent) {
          this.el.detachEvent('on' + eventType, handler);
        }
      }, this);
      (0, _reboundUtils2.default)(this.el).walkTheDOM(function (el) {
        if (el.__lazyValue && el.__lazyValue.destroy()) {
          n.__lazyValue.destroy();
        }
      });
      delete this.el.__listeners;
      delete this.el.__events;
      delete this.$el;
      delete this.el;
    }

    // Clean up Hook callback references
    delete this.__observers;

    // Mark as deinitialized so we don't loop on cyclic dependancies.
    this.deinitialized = true;

    // Destroy all children of this data object.
    // If a Collection, de-init all of its Models, if a Model, de-init all of its
    // Attributes that aren't services, if a Computed Property, de-init its Cache objects.
    _.each(this.models, function (val) {
      val && val.deinitialize && val.deinitialize();
    });
    this.models && (this.models.length = 0);
    _.each(this.attributes, function (val, key) {
      delete _this.attributes[key];
      val && !val.isComponent && val.deinitialize && val.deinitialize();
    });
    if (this.cache) {
      this.cache.collection.deinitialize();
      this.cache.model.deinitialize();
    }
  }
};

// Extend all of the **Rebound Data** prototypes with these shared methods
_.extend(_model2.default.prototype, sharedMethods);
_.extend(_collection2.default.prototype, sharedMethods);
_.extend(_computedProperty2.default.prototype, sharedMethods);

exports.Model = _model2.default;
exports.Collection = _collection2.default;
exports.ComputedProperty = _computedProperty2.default;
exports.default = { Model: _model2.default, Collection: _collection2.default, ComputedProperty: _computedProperty2.default };
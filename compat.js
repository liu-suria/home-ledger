/* Small fallbacks for older iPhone Safari versions. Loaded before app modules. */
(function () {
  if (!Element.prototype.replaceChildren) {
    Element.prototype.replaceChildren = function () {
      while (this.firstChild) this.removeChild(this.firstChild);
      for (var i = 0; i < arguments.length; i += 1) this.append(arguments[i]);
    };
  }
  if (!window.structuredClone) {
    window.structuredClone = function (value) {
      return JSON.parse(JSON.stringify(value));
    };
  }
}());

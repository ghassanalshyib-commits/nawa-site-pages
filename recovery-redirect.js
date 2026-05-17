(function(){
  var hash = window.location.hash || "";
  if (hash.indexOf("type=recovery") !== -1 && !window.location.pathname.endsWith("reset-password.html")) {
    var basePath = window.location.pathname.replace(/[^/]*$/, "");
    window.location.replace(basePath + "reset-password.html" + hash);
  }
})();

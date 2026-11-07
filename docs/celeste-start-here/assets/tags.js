
(function () {
  var buttons = document.querySelectorAll(".tag-buttons button");
  var rows = document.querySelectorAll("#source-table tbody tr");
  if (!buttons.length) return;
  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      var tag = button.getAttribute("data-tag");
      rows.forEach(function (row) {
        var tags = row.getAttribute("data-tags") || "";
        row.hidden = tag !== "*" && tags.split(/\s+/).indexOf(tag) === -1;
      });
    });
  });
})();

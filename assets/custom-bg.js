(function () {
  "use strict";

  var STORAGE_KEY = "revision-tracker-bg-settings";
  var MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB safety cap for localStorage
  var STYLE_TAG_ID = "custom-bg-style";

  function loadSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { mode: "default" };
    } catch (e) {
      return { mode: "default" };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      return true;
    } catch (e) {
      return false;
    }
  }

  function getStyleTag() {
    var tag = document.getElementById(STYLE_TAG_ID);
    if (!tag) {
      tag = document.createElement("style");
      tag.id = STYLE_TAG_ID;
      document.head.appendChild(tag);
    }
    return tag;
  }

  function applySettings(settings) {
    var tag = getStyleTag();
    if (!settings || settings.mode === "default") {
      tag.textContent = "";
      return;
    }
    if (settings.mode === "color" && settings.color) {
      tag.textContent =
        "html, body { background-image: none !important; " +
        "background-color: " + settings.color + " !important; }";
      return;
    }
    if (settings.mode === "image" && settings.image) {
      tag.textContent =
        "html, body { background-image: url('" + settings.image + "') !important; " +
        "background-size: cover !important; background-position: center !important; " +
        "background-repeat: no-repeat !important; background-attachment: fixed !important; }";
      return;
    }
    tag.textContent = "";
  }

  // Apply immediately on script load (before UI is built) to avoid any flash.
  var current = loadSettings();
  applySettings(current);

  function buildUI() {
    var wrap = document.createElement("div");
    wrap.id = "custom-bg-widget";

    var toggleBtn = document.createElement("button");
    toggleBtn.id = "custom-bg-toggle";
    toggleBtn.type = "button";
    toggleBtn.title = "Background settings";
    toggleBtn.textContent = "🎨";

    var panel = document.createElement("div");
    panel.id = "custom-bg-panel";
    panel.style.display = "none";

    panel.innerHTML =
      '<div class="cbg-row cbg-title">Background</div>' +
      '<div class="cbg-row">' +
      '  <label class="cbg-label" for="cbg-color-input">Color</label>' +
      '  <input type="color" id="cbg-color-input" value="#0d1118" />' +
      '  <button type="button" id="cbg-default-btn" class="cbg-btn">Default</button>' +
      "</div>" +
      '<div class="cbg-row">' +
      '  <label class="cbg-label" for="cbg-image-input">Image</label>' +
      '  <input type="file" id="cbg-image-input" accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,.svg,image/*" />' +
      "</div>" +
      '<div class="cbg-row" id="cbg-image-preview-row" style="display:none;">' +
      '  <img id="cbg-image-preview" alt="Background preview" />' +
      '  <button type="button" id="cbg-remove-image-btn" class="cbg-btn">Remove image</button>' +
      "</div>" +
      '<div class="cbg-row cbg-hint" id="cbg-status"></div>';

    wrap.appendChild(toggleBtn);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);

    var colorInput = panel.querySelector("#cbg-color-input");
    var defaultBtn = panel.querySelector("#cbg-default-btn");
    var imageInput = panel.querySelector("#cbg-image-input");
    var imagePreviewRow = panel.querySelector("#cbg-image-preview-row");
    var imagePreview = panel.querySelector("#cbg-image-preview");
    var removeImageBtn = panel.querySelector("#cbg-remove-image-btn");
    var status = panel.querySelector("#cbg-status");

    function setStatus(msg, isError) {
      status.textContent = msg || "";
      status.style.color = isError ? "#fb7185" : "";
      if (msg) {
        setTimeout(function () {
          if (status.textContent === msg) status.textContent = "";
        }, 3000);
      }
    }

    function refreshFromSettings(settings) {
      if (settings.mode === "color" && settings.color) {
        colorInput.value = settings.color;
      }
      if (settings.mode === "image" && settings.image) {
        imagePreview.src = settings.image;
        imagePreviewRow.style.display = "flex";
      } else {
        imagePreviewRow.style.display = "none";
      }
    }

    refreshFromSettings(current);

    toggleBtn.addEventListener("click", function () {
      panel.style.display = panel.style.display === "none" ? "flex" : "none";
    });

    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) {
        panel.style.display = "none";
      }
    });

    colorInput.addEventListener("input", function () {
      var settings = { mode: "color", color: colorInput.value };
      applySettings(settings);
      saveSettings(settings);
      current = settings;
      imagePreviewRow.style.display = "none";
    });

    defaultBtn.addEventListener("click", function () {
      var settings = { mode: "default" };
      applySettings(settings);
      saveSettings(settings);
      current = settings;
      imagePreviewRow.style.display = "none";
      setStatus("Reset to default background.");
    });

    imageInput.addEventListener("change", function () {
      var file = imageInput.files && imageInput.files[0];
      if (!file) return;

      var okTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/bmp",
        "image/svg+xml",
      ];
      if (okTypes.indexOf(file.type) === -1) {
        setStatus("Unsupported file type. Use JPG, PNG, WEBP, GIF, BMP or SVG.", true);
        imageInput.value = "";
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setStatus("Image is too large (max 4MB). Please choose a smaller file.", true);
        imageInput.value = "";
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        var dataUrl = reader.result;
        var settings = { mode: "image", image: dataUrl };
        var ok = saveSettings(settings);
        if (!ok) {
          setStatus("Could not save image (storage full). Try a smaller image.", true);
          return;
        }
        applySettings(settings);
        current = settings;
        imagePreview.src = dataUrl;
        imagePreviewRow.style.display = "flex";
        setStatus("Background image applied.");
      };
      reader.onerror = function () {
        setStatus("Failed to read image file.", true);
      };
      reader.readAsDataURL(file);
    });

    removeImageBtn.addEventListener("click", function () {
      var settings = { mode: "default" };
      applySettings(settings);
      saveSettings(settings);
      current = settings;
      imagePreviewRow.style.display = "none";
      imageInput.value = "";
      setStatus("Background image removed.");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildUI);
  } else {
    buildUI();
  }
})();

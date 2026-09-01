(function () {
  "use strict";

  var STORAGE_KEY = "revision-tracker-bg-settings";
  var MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB safety cap for localStorage
  var STYLE_TAG_ID = "custom-bg-style";
  var DEFAULT_OPACITY = 68; // % opacity for panels/sidebar when a custom bg is active
  var DEFAULT_TINT = "light"; // "light" = white glass (Gmail-style), "dark" = tinted with app's own dark colors

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

  function clampOpacity(v) {
    v = typeof v === "number" && !isNaN(v) ? v : DEFAULT_OPACITY;
    return Math.max(20, Math.min(90, v));
  }

  function normalizeTint(v) {
    return v === "dark" ? "dark" : DEFAULT_TINT;
  }

  function applySettings(settings) {
    var tag = getStyleTag();
    var root = document.documentElement;

    if (!settings || settings.mode === "default") {
      tag.textContent = "";
      root.classList.remove("cbg-active");
      root.style.removeProperty("--cbg-alpha");
      root.removeAttribute("data-cbg-tint");
      return;
    }

    // Make the sidebar + all cards/panels translucent so the custom
    // background shows through everywhere (Gmail-style glass look),
    // instead of only showing in the small gaps around content.
    var opacityPct = clampOpacity(settings.opacity) + "%";
    root.style.setProperty("--cbg-alpha", opacityPct);
    root.classList.add("cbg-active");
    root.setAttribute("data-cbg-tint", normalizeTint(settings.tint));

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
    root.classList.remove("cbg-active");
    root.style.removeProperty("--cbg-alpha");
    root.removeAttribute("data-cbg-tint");
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
      '<div class="cbg-row">' +
      '  <label class="cbg-label" for="cbg-opacity-input">Panels</label>' +
      '  <input type="range" id="cbg-opacity-input" min="20" max="90" step="5" />' +
      '  <span class="cbg-opacity-value" id="cbg-opacity-value"></span>' +
      "</div>" +
      '<div class="cbg-row">' +
      '  <span class="cbg-label">Tint</span>' +
      '  <div class="cbg-seg">' +
      '    <button type="button" id="cbg-tint-light" class="cbg-seg-btn">White</button>' +
      '    <button type="button" id="cbg-tint-dark" class="cbg-seg-btn">Dark</button>' +
      "  </div>" +
      "</div>" +
      '<div class="cbg-row cbg-hint">Panels turn glassy/see-through once a background is set, so it shows everywhere — including the sidebar.</div>' +
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
    var opacityInput = panel.querySelector("#cbg-opacity-input");
    var opacityValue = panel.querySelector("#cbg-opacity-value");
    var tintLightBtn = panel.querySelector("#cbg-tint-light");
    var tintDarkBtn = panel.querySelector("#cbg-tint-dark");
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

    function refreshTintButtons(tint) {
      var t = normalizeTint(tint);
      tintLightBtn.classList.toggle("active", t === "light");
      tintDarkBtn.classList.toggle("active", t === "dark");
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
      var op = clampOpacity(settings.opacity);
      opacityInput.value = op;
      opacityValue.textContent = op + "%";
      refreshTintButtons(settings.tint);
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
      current = {
        mode: "color",
        color: colorInput.value,
        opacity: clampOpacity(current.opacity),
        tint: normalizeTint(current.tint),
      };
      applySettings(current);
      saveSettings(current);
      imagePreviewRow.style.display = "none";
    });

    defaultBtn.addEventListener("click", function () {
      current = { mode: "default", opacity: clampOpacity(current.opacity), tint: normalizeTint(current.tint) };
      applySettings(current);
      saveSettings(current);
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
        var settings = {
          mode: "image",
          image: dataUrl,
          opacity: clampOpacity(current.opacity),
          tint: normalizeTint(current.tint),
        };
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
      current = { mode: "default", opacity: clampOpacity(current.opacity), tint: normalizeTint(current.tint) };
      applySettings(current);
      saveSettings(current);
      imagePreviewRow.style.display = "none";
      imageInput.value = "";
      setStatus("Background image removed.");
    });

    opacityInput.addEventListener("input", function () {
      var op = clampOpacity(parseInt(opacityInput.value, 10));
      current.opacity = op;
      opacityValue.textContent = op + "%";
      applySettings(current);
      saveSettings(current);
    });

    tintLightBtn.addEventListener("click", function () {
      current.tint = "light";
      refreshTintButtons("light");
      applySettings(current);
      saveSettings(current);
    });

    tintDarkBtn.addEventListener("click", function () {
      current.tint = "dark";
      refreshTintButtons("dark");
      applySettings(current);
      saveSettings(current);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildUI);
  } else {
    buildUI();
  }
})();

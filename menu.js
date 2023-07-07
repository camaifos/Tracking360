class MenuBox {
  constructor(parent, label, iconUrl, content) {
    this.container = createDiv();
    this.container.addClass("menubox");
    this.container.parent(parent);

    this.labelBox = createDiv(label);
    this.labelBox.addClass("menubox-label");
    this.labelBox.parent(this.container);

    this.iconBox = createDiv();
    this.iconBox.style("background-image", "url(" + iconUrl + ")");
    this.iconBox.addClass("menubox-icon");
    this.iconBox.mouseClicked(() => {
      this.container.toggleClass("active");
      this.contentBox.toggleClass("hidden");

      if (this.container.hasClass("active")) {
        this.contentBox.style("max-height", this.contentBox.elt.scrollHeight + "px");
      } else {
        this.contentBox.style("max-height", "0");
      }
    });
    this.iconBox.parent(this.container);

    this.contentBox = createDiv();
    this.contentBox.child(content);
    this.contentBox.addClass("menubox-content");
    this.contentBox.addClass("hidden");
    this.contentBox.parent(this.container);
  }

  setContent(content) {
    for (const child of this.contentBox.child()) {
      child.remove();
    }
    this.contentBox.child(content);

    if (this.container.hasClass("active")) {
      this.contentBox.style("max-height", this.contentBox.elt.scrollHeight + "px");
    } else {
      this.contentBox.style("max-height", "0");
    }
  }
}

function createTextButton(html, onclick) {
  const a = createA("javascript:void(0);", html);
  a.mouseClicked(onclick);
  a.addClass("button");
  return a;
}

function createLabelledSlider(min, max, value, step) {
  const container = createDiv();
  let slider;
  if (value !== undefined) {
    if (step !== undefined) {
      slider = createSlider(min, max, value, step);
    } else {
      slider = createSlider(min, max, value);
    }
  } else {
    slider = createSlider(min, max);
  }
  const label = createSpan(value);
  container.child(slider);
  container.child(label);

  slider.class("slider");

  slider.input(() => label.html(slider.value()));
  container.value = (value) => {
    if (value !== undefined) {
      return slider.value(value);
    } else {
      return slider.value();
    }
  };
  return container;
}

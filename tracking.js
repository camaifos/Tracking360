/*  Each tracker has:
 *    - label: Readable name of the tracker
 *    - params: Content to be displayed in the tuning box. Is called once from
 *      the top-level setup function
 *    - description: Content to be displayed in the info box. Is called once
 *      from the top-level setup function
 *    - init(): Setup, if needed. Is called once from the top-level setup
 *      function
 *    - changedSource(video): Called when the video source changes  
 *    - track(video, previewCtx, previewLastClick): Takes a video and returns
 *      a 2D vector, optionally draw preview overlays onto previewCtx. If there
 *      was a click event on the preview since the last frame,
 *      previewLastClick is a 2D vector with the relative coordinates of the
 *      click.
 */
const trackers = [
  /*
   *  Color tracker
   */
  {
    label: "Farbe",
    get params() {
      const params = createDiv();
      params.child(createP("Klicke auf das Panoramavideo oder nutze den Farbwähler um eine Farbe zu verfolgen."))
      this.colorPicker = createColorPicker(this.color);
      params.child(this.colorPicker);
      return params;
    },
    description: "Die Verfolgung von Objekten anhand der Farbe ist eine der schnellsten und einfachsten Methoden zur Verfolgung eines Objekts von einem Frame zum nächsten. Die Geschwindigkeit dieser Technik macht sie für echtzeitnahe Anwendungen sehr attraktiv, aber aufgrund ihrer Einfachheit gibt es viele Probleme, die zum Scheitern der Verfolgung führen können.",

    init() {
      this.color = color(255, 0, 0);
    },

    changedSource(video) { },

    track(video, previewCtx, previewLastClick) {
      this.color = this.colorPicker.color();
      const r2 = red(this.color);
      const g2 = green(this.color);
      const b2 = blue(this.color);

      if (previewLastClick) {
        this.color = color(video.get(
          map(previewLastClick.x, 0, previewCtx.width, 0, video.width),
          map(previewLastClick.y, 0, previewCtx.height, 0, video.height)
        ));
        this.colorPicker.value(this.color.toString('#rrggbb'));
      }

      // We are going to look at the video's pixels
      video.loadPixels();

      // Before we begin searching, the "world record" for closest color is set to a high number that is easy for the first pixel to beat.
      let worldRecord = sq(500);
      let closestX, closestY;

      for (let y = 0; y < video.height; y += 8) {
        for (let x = 0; x < video.width; x += 8) {
          let loc = (x + y * video.width) * 4;
          let r1 = video.pixels[loc];
          let g1 = video.pixels[loc + 1];
          let b1 = video.pixels[loc + 2];
          let d = sq(r2 - r1) + sq(g2 - g1) + sq(b2 - b1);

          // If current color is more similar to tracked color than
          // closest color, save current location and current difference
          if (d < worldRecord) {
            worldRecord = d;
            closestX = x;
            closestY = y;
          }
        }
      }

      // We only consider the color found if its color distance is less than 50.
      // This threshold of 50 is arbitrary and you can adjust this number depending on how accurate you require the tracking to be.
      if (worldRecord > sq(50)) {
        return;
      }

      // Draw a circle at the tracked pixel
      previewCtx.fill(video.get(closestX, closestY));
      previewCtx.circle(
        map(closestX, 0, video.width, 0, previewCtx.width),
        map(closestY, 0, video.height, 0, previewCtx.height),
        20
      );

      return createVector(closestX, closestY);
    },
  },

  /*
   *  Brightness tracker
   */
  {
    label: "Helligkeit",
    get params() {
      const params = createDiv();
      params.child(createP("Verschiebe den Regler um die dunkelste bis hellste Stelle zu verfolgen."))
      this.targetBrightnessSlider = createLabelledSlider(0, 255, this.targetBrightness);
      this.targetBrightnessSlider.style("margin-top", "10px");
      params.child(this.targetBrightnessSlider);
      return params;
    },

    init() {
      this.targetBrightness = 255;
    },

    changedSource(video) { },

    track(video, previewCtx) {
      this.targetBrightness = this.targetBrightnessSlider.value();

      let closestValue = 256 * 3;
      let closestX, closestY;

      video.loadPixels();
      for (let y = 0; y < video.height; y += 8) {
        for (let x = 0; x < video.width; x += 8) {
          let loc = (x + y * video.width) * 4;
          let r = video.pixels[loc];
          let g = video.pixels[loc + 1];
          let b = video.pixels[loc + 2];
          let brightness = (r + g + b);
          let distance = abs(this.targetBrightness * 3 - brightness);

          if (distance < closestValue) {
            closestValue = distance;
            closestX = x;
            closestY = y;
          }
        }
      }

      if (closestX === undefined || closestY === undefined) {
        return;
      }

      // Draw a circle at the closest pixel
      previewCtx.fill(brightness(video.get(closestX, closestY)) / 100 * 255);
      previewCtx.circle(
        map(closestX, 0, video.width, 0, previewCtx.width),
        map(closestY, 0, video.height, 0, previewCtx.height),
        20
      );

      return createVector(closestX, closestY);
    },
  },

  /*
   *  Point tracker
   */
  {
    label: "Pixelverfolgung",
    get params() {
      const params = createDiv();
      params.child(createP("Klicke auf das Panoramavideo um einen Punkt zu verfolgen."))
      return params;
    },

    init() {
      this.pointCount = 0;
      this.winSize = 20;
      this.maxIter = 30;
      this.eps = 0.01;
      this.minEigenThreshold = 0.001;
    },

    changedSource(video) {
      this.prevPyr = new jsfeat.pyramid_t(3);
      this.prevPyr.allocate(video.width, video.height, jsfeat.U8C1_t);
      this.curPyr = new jsfeat.pyramid_t(3);
      this.curPyr.allocate(video.width, video.height, jsfeat.U8C1_t);
      this.pointCount = 0;
      this.pointStatus = new Uint8Array(1);
      this.prevXY = new Float32Array(2);
      this.prevXY[0] = -1;
      this.prevXY[1] = -1;
      this.curXY = new Float32Array(2);
      this.curXY[0] = -1;
      this.curXY[1] = -1;
    },

    track(video, previewCtx, previewLastClick) {
      if (previewLastClick) {
        this.pointCount = 1;
        this.curXY[0] = map(previewLastClick.x, 0, previewCtx.width, 0, video.width);
        this.curXY[1] = map(previewLastClick.y, 0, previewCtx.height, 0, video.height);
      }

      video.loadPixels();

      if (video.pixels.length === 0) {
        return;
      }

      // Swap previous and current
      const XYSwap = this.prevXY;
      this.prevXY = this.curXY;
      this.curXY = XYSwap;
      const pyrSwap = this.prevPyr;
      this.prevPyr = this.curPyr;
      this.curPyr = pyrSwap;

      jsfeat.imgproc.grayscale(video.pixels, video.width, video.height, this.curPyr.data[0]);
      this.curPyr.build(this.curPyr.data[0], true);
      jsfeat.optical_flow_lk.track(this.prevPyr, this.curPyr, this.prevXY, this.curXY, this.pointCount, this.winSize, this.maxIter, this.pointStatus, this.eps, this.minEigenThreshold);

      // Prune points
      let i = 0, j = 0;
      for (let i = 0; i < this.pointCount; ++i) {
        if (this.pointStatus[i] === 1) {
          if (j < i) {
            this.curXY[j * 2] = this.curXY[i * 2];
            this.curXY[j * 2 + 1] = this.curXY[i * 2 + 1];
          }
          previewCtx.circle(
            map(this.curXY[j * 2], 0, video.width, 0, previewCtx.width),
            map(this.curXY[j * 2 + 1], 0, video.height, 0, previewCtx.height),
            5
          );
          ++j;
        }
      }

      if (this.curXY[0] === -1 || this.curXY[1] === -1) {
        return;
      }

      // Draw a circle at the tracked point
      previewCtx.noFill();
      previewCtx.strokeWeight(2);
      previewCtx.stroke(255);
      previewCtx.circle(map(this.curXY[0], 0, video.width, 0, previewCtx.width), map(this.curXY[1], 0, video.height, 0, previewCtx.height), 20);
      previewCtx.stroke(0);
      previewCtx.circle(map(this.curXY[0], 0, video.width, 0, previewCtx.width), map(this.curXY[1], 0, video.height, 0, previewCtx.height), 24);

      return createVector(this.curXY[0], this.curXY[1]);
    },
  },

  /*
   *  Optical flow tracker
   */
  {
    label: "Bewegung",
    get params() {
      const params = createDiv();
      params.child(createP("Bestimme die Zonengrösse in denen die grösste Bewegung gemessen wird und dessen Empfindlichkeit mit den Regeln."));
      this.zoneSizeSlider = createLabelledSlider(1, 100, this.zoneSize, 1);
      this.zoneSizeSlider.style("margin-bottom", "10px");
      this.thresholdSlider = createLabelledSlider(0, 100, this.threshold);
      this.xAxisCheckbox = createCheckbox("X-Achse", this.xAxis);
      this.yAxisCheckbox = createCheckbox("Y-Achse", this.yAxis);
      params.child(createP("</br>Zonengrösse"));
      params.child(this.zoneSizeSlider);
      params.child(createP("Empfindlichkeit"));
      params.child(this.thresholdSlider);
      params.child(createP("</br>Wähle aus entlang welcher Achse die Bewegung gemessen werden soll."));
      params.child(this.xAxisCheckbox);
      params.child(this.yAxisCheckbox);
      return params;
    },

    init() {
      this.zoneSize = 8;
      this.threshold = 8;
      this.xAxis = true;
      this.yAxis = true;
    },

    changedSource(video) {
      this.flow = new FlowCalculator(this.zoneSize);
      delete this.previousPixels;
    },

    track(video, previewCtx) {
      this.zoneSize = this.zoneSizeSlider.value();
      this.threshold = this.thresholdSlider.value();
      this.xAxis = this.xAxisCheckbox.checked();
      this.yAxis = this.yAxisCheckbox.checked();

      if (this.flow.step !== this.zoneSize) {
        this.flow = new FlowCalculator(this.zoneSize);
      }

      video.loadPixels();
      if (video.pixels.length === 0) {
        return;
      }

      if (this.previousPixels) {
        this.flow.calculate(this.previousPixels, video.pixels, video.width, video.height);
        if (this.flow.zones) {
          // Find the zone with the largest magnitude
          let largestMag = 0;
          let largestZone;
          for (let zone of this.flow.zones) {
            if (zone.mag < this.threshold) {
              continue;
            }

            let alpha = QUARTER_PI / 2;  // 45°
            if (!this.xAxis && !this.yAxis) {
              continue;
            } else if (this.xAxis && !this.yAxis) {
              if ((-PI + alpha < zone.angle && zone.angle < -alpha) || (alpha < zone.angle && zone.angle < PI - alpha)) {
                continue;
              }
            } else if (this.yAxis && !this.xAxis) {
              if ((-PI <= zone.angle && zone.angle < -PI / 2 - alpha) || (-PI / 2 + alpha < zone.angle && zone.angle < PI / 2 - alpha) || (PI / 2 + alpha < zone.angle && zone.angle <= PI)) {
                continue;
              }
            }

            // Draw arrow
            const pos = createVector(
              map(zone.pos.x, 0, video.width, 0, previewCtx.width),
              map(zone.pos.y, 0, video.height, 0, previewCtx.height)
            );
            const mag = map(zone.mag, 0, video.height, 0, previewCtx.height);
            previewCtx.push();
            previewCtx.translate(pos.x, pos.y);
            previewCtx.rotate(zone.angle);
            previewCtx.strokeWeight(2);
            previewCtx.stroke(255);
            previewCtx.line(0, 0, mag, 0);
            previewCtx.line(mag, 0, mag - 5, -5);
            previewCtx.line(mag, 0, mag - 5, 5);
            previewCtx.pop();

            if (zone.mag > largestMag) {
              largestMag = zone.mag;
              largestZone = zone;
            }
          }

          if (largestZone) {
            return createVector(largestZone.pos.x, largestZone.pos.y);
          }
        }
      }

      // copy the current pixels into previous
      // for the next frame
      this.previousPixels = copyImage(video.pixels, this.previousPixels);
    },
  },

  /*
   *  Object tracker
   */
  {
    label: "Objekterkennung",
    get params() {
      const params = createDiv();
      params.child(createP("Wähle welcher Themenbereich verfolgt werden soll."));
      this.peopleCheckbox = createCheckbox("Personen", this.people);
      this.objectsCheckbox = createCheckbox("Objekte", this.objects);
      params.child(this.peopleCheckbox);
      params.child(this.objectsCheckbox);
      return params;
    },

    init() {
      this.people = true;
      this.objects = true;

      this.detector = ml5.objectDetector('cocossd');
    },

    changedSource(video) {

    },

    track(video, previewCtx) {
      this.people = this.peopleCheckbox.checked();
      this.objects = this.objectsCheckbox.checked();

      if (!this.detector.modelReady) {
        return;
      }

      if (!this.detector.isPredicting) {
        this.detector.detect(video)
          .then(results => {
            this.results = results;
          });
      }

      if (!this.results) {
        return;
      }

      let i = 0;
      let vec;
      for (let obj of this.results) {
        if (obj.label === 'person' && !this.people) {
          continue;
        } else if (obj.label !== 'person' && !this.objects) {
          continue;
        }

        if (i++ === 0) {
          vec = createVector(obj.x + obj.width / 2, obj.y + obj.height / 2);
          previewCtx.stroke(0, 255, 0);
        } else {
          previewCtx.stroke(255, 255, 255);
        }
        previewCtx.strokeWeight(4);
        previewCtx.noFill();
        previewCtx.rect(
          map(obj.x, 0, video.width, 0, previewCtx.width),
          map(obj.y, 0, video.height, 0, previewCtx.height),
          map(obj.width, 0, video.width, 0, previewCtx.width),
          map(obj.height, 0, video.height, 0, previewCtx.height)
        );
        previewCtx.noStroke();
        previewCtx.fill(255);
        previewCtx.textSize(24);
        previewCtx.text(
          obj.label,
          map(obj.x, 0, video.width, 0, previewCtx.width) + 10,
          map(obj.y, 0, video.height, 0, previewCtx.height) + 24);
      }
      if (vec) {
        return vec;
      }
    },
  },
];

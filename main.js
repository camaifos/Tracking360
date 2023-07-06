const videoSrcs = [
  {
    src: 'media/Tassen.min.MP4',
    label: 'Tassen',
  },
  {
    src: 'media/R0010623.min.mp4',
    label: 'Chilbi',
  },
  {
    src: 'media/R0010614.min.mp4',
    label: 'Jucy Lemon Club',
  },
  {
    src: 'media/R0010605.min.mp4',
    label: 'Bandprobe',
  },
];

let videos;
let activeVideo;
let activeTracker;
let focusPoint;
let paused = false;

let preview;
let previewLastClick = null;

let sourceBox;
let trackingBox;
let tuningBox;
let infoBox;
let aboutBox;

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  canvas.parent('canvas-container');
  pixelDensity(1);

  videos = [];
  for (const src of videoSrcs) {
    const video = createVideo(src.src, () => {
      video.elt.muted = true;
    });
    video.hide();
    videos.push({
      video: video,
      label: src.label,
      ready: false,
    });
  }

  activeVideo = videos[0];
  activeVideo.video.loop();
  activeVideo.video.elt.addEventListener('loadedmetadata', () => {
    for (const tracker of trackers) {
      tracker.changedSource(activeVideo.video);
    }
    focusPoint = createVector(activeVideo.video.width / 2, activeVideo.video.height / 2);
  });

  for (const tracker of trackers) {
    tracker.init();
  }

  activeTracker = trackers[0];

  preview = createGraphics(400, 200);
  preview.mouseClicked((event) => {
    previewLastClick = createVector(event.offsetX, event.offsetY);
  });

  setupMenu();
}

function draw() {
  background(220);

  activeVideo.video.loadPixels();
  if (activeVideo.video.pixels.length === 0) {
    return;
  }

  preview.image(activeVideo.video, 0, 0, preview.width, preview.height);

  const trackPoint = activeTracker.track(activeVideo.video, preview, previewLastClick);
  previewLastClick = null;

  if (paused) {
    // TODO
  } else {
    if (trackPoint) {
      const prevFocusPoint = focusPoint;
      focusPoint = easing(trackPoint, prevFocusPoint, 0.05);
      if (abs(trackPoint.x - prevFocusPoint.x) > activeVideo.video.width / 2) {
        if (trackPoint.x > prevFocusPoint.x) {
          focusPoint.x += activeVideo.video.width;
        } else {
          focusPoint.x -= activeVideo.video.width;
        }
      }
    }
    if (focusPoint) {
      panoView(activeVideo.video, focusPoint);
    }
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function setupMenu() {
  const menu = select('#menu-container');

  // Source
  // TODO: Add a way to select a video file and call activeTracker.changedSource(video)
  const sourceContent = createDiv();
  sourceContent.addClass('vertical-stack');
  sourceContent.child(preview);
  preview.show();
  const sourceList = createDiv();
  sourceList.parent(sourceContent);
  sourceList.addClass('horizontal-stack');
  for (const video of videos) {
    const videoBtn = createTextButton(video.label, () => {
      for (const video of videos) {
        // Plays from the beginning next time, alternatively use .pause()
        video.video.stop();
      }
      activeVideo = video;
      activeVideo.video.loop();
      for (const tracker of trackers) {
        tracker.changedSource(video.video);
      }
      focusPoint = createVector(activeVideo.video.width / 2, activeVideo.video.height / 2);
    });
    videoBtn.parent(sourceList);
  }
  sourceBox = new MenuBox(
    menu,
    "Source",
    'media/Panoramavideo.png',
    sourceContent
  );
  sourceBox.container.addClass('source-box');

  // Tracking
  const trackingContent = createDiv();
  trackingContent.addClass('vertical-stack');
  for (const tracker of trackers) {
    const trackerBtn = createTextButton(tracker.label, () => {
      activeTracker = tracker;
      tuningBox.setContent(tracker.params);
    });
    trackerBtn.parent(trackingContent);
  }
  trackingBox = new MenuBox(
    menu,
    "Tracking",
    'media/Tracking.png',
    trackingContent
  );

  // Tuning
  const tuningContent = activeTracker.params;
  tuningBox = new MenuBox(
    menu,
    "Tuning",
    'media/Parameter.png',
    tuningContent
  );

  // Info
  const infoContent = createP(activeTracker.description);
  infoBox = new MenuBox(
    menu,
    "Info",
    'media/Infos.png',
    infoContent
  );

  // About
  const aboutContent = createDiv()
    .child(createP("Möglichkeiten von Tracking in 360°</br>Ein Open Source Projekt"))
    .child(createP("BA-Thesis</br>IDCE FHNW HGK, Basel</br>Sofia Camprubi"));
  // ...
  aboutBox = new MenuBox(
    menu,
    "About",
    'media/Danke.png',
    aboutContent
  );
}

function easing(trackPoint, prevFocusPoint, amount) {
  return p5.Vector.add(prevFocusPoint, p5.Vector.sub(trackPoint, prevFocusPoint).mult(amount));
}

function panoView(pano, trackPoint) {
  push();
  noStroke();
  texture(pano);
  translate(0, 0);

  rotateX(map(trackPoint.y, 0, pano.height, PI / 2, -PI / 2));
  rotateY(map(trackPoint.x, 0, pano.width, -PI, PI));

  scale(-1, 1); // important since we're inside sphere!
  sphere(height);
  pop();
}

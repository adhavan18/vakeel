import { registerRoot, Composition } from "remotion";
import { Launch, FPS, buildTimeline } from "./Launch.jsx";
import { Short, SHORT_FPS, shortTimeline } from "./Short.jsx";

const Root = () => (
  <>
    <Composition id="Launch" component={Launch} durationInFrames={buildTimeline().total} fps={FPS} width={1920} height={1080} />
    <Composition id="Short" component={Short} durationInFrames={shortTimeline().total} fps={SHORT_FPS} width={1080} height={1920} />
  </>
);

registerRoot(Root);

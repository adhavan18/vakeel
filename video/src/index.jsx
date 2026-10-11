import { registerRoot, Composition } from "remotion";
import { Launch, FPS, buildTimeline } from "./Launch.jsx";
import { Short, SHORT_FPS, shortTimeline } from "./Short.jsx";
import { Thumbnail } from "./Thumbnail.jsx";
import { LaunchV2, FPS2, timelineV2 } from "./Launch2.jsx";
import { Hype, FPS3, timelineV3 } from "./Hype.jsx";

const Root = () => (
  <>
    <Composition id="Launch" component={Launch} durationInFrames={buildTimeline().total} fps={FPS} width={1920} height={1080} />
    <Composition id="Short" component={Short} durationInFrames={shortTimeline().total} fps={SHORT_FPS} width={1080} height={1920} />
    <Composition id="LaunchV2" component={LaunchV2} durationInFrames={timelineV2().total} fps={FPS2} width={1920} height={1080} />
    <Composition id="Hype" component={Hype} durationInFrames={timelineV3().total} fps={FPS3} width={1920} height={1080} />
    <Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={30} width={1280} height={720} />
  </>
);

registerRoot(Root);

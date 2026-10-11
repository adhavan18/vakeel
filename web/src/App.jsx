import { Component } from "react";
import { useRoute, go } from "./lib.js";
import { MOCK } from "./api.js";
import Home from "./components/Home.jsx";
import DocumentPage from "./components/DocumentPage.jsx";
import ProjectPage from "./components/ProjectPage.jsx";
import ObjectionPage from "./components/ObjectionPage.jsx";

function Header() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-black/5 bg-[rgba(251,251,253,0.72)] backdrop-blur-xl backdrop-saturate-[180%]">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-5">
        <a href="#/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-paper text-[13px] font-bold text-white">व</span>
          <span className="text-[17px] font-semibold tracking-tight">Vakeel</span>
        </a>
        <nav className="flex items-center gap-6 text-[13px] text-paper/80">
          <a href="#/filings" className="hidden hover:text-paper sm:inline">Filings</a>
          <a href="#/how" className="hidden hover:text-paper sm:inline">How it works</a>
          <button
            onClick={() => go("/read")}
            className="press rounded-full bg-action px-3.5 py-1 text-[13px] font-medium text-white hover:bg-[#0077ed]"
          >
            Read a filing
          </button>
        </nav>
      </div>
      {MOCK && <div className="bg-amber/10 py-1 text-center text-xs text-amber">Offline preview with a real exported analysis</div>}
    </header>
  );
}

function Footer() {
  return (
    <footer className="no-print mt-24 border-t hairline">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-10 text-[13px] text-dim sm:flex-row sm:justify-between">
        <p>
          Vakeel reads public filings from India's PARIVESH portal. Every figure links to the page it came from.
        </p>
        <p>Built on Amazon Bedrock · Step Functions · Lambda · DynamoDB · S3 · CloudFront</p>
      </div>
    </footer>
  );
}

class Boundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-3xl px-5 py-24">
        <p className="serif text-4xl">Something went wrong on this page.</p>
        <button onClick={() => window.location.reload()} className="press mt-6 rounded-full bg-action px-5 py-2 text-sm font-medium text-white">
          Reload
        </button>
      </div>
    );
  }
}

export default function App() {
  const parts = useRoute();
  let page;
  if (parts[0] === "doc" && parts[2] === "p") page = <ProjectPage docId={parts[1]} n={parts[3]} />;
  else if (parts[0] === "doc") page = <DocumentPage docId={parts[1]} />;
  else if (parts[0] === "objection") page = <ObjectionPage objectionId={parts[1]} />;
  else page = <Home focus={parts[0]} />;
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Boundary key={parts.join("/")}>{page}</Boundary>
      </main>
      <Footer />
    </div>
  );
}

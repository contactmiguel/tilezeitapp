"use client";

import { useWorkspace } from "@/context/WorkspaceContext";
import TopBar from "./TopBar";
import WorkspaceBody from "./WorkspaceBody";

export default function ProjectWorkspace() {
  const { state, dispatch } = useWorkspace();

  return (
    <main className="workspace">
      <TopBar
        projectName={state.projectName}
        onProjectNameChange={(name) =>
          dispatch({ type: "SET_PROJECT_NAME", payload: name })
        }
      />
      <WorkspaceBody mode={state.mode} />
    </main>
  );
}

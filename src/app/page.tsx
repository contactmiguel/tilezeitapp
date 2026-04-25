import ProjectWorkspace from "@/components/workspace/ProjectWorkspace";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import "@/styles/workspace.css";

export default function HomePage() {
  return (
    <WorkspaceProvider>
      <ProjectWorkspace />
    </WorkspaceProvider>
  );
}

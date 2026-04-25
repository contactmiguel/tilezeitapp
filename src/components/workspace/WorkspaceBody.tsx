import RightPanel from "./RightPanel";
import PlanCanvas from "../canvas/PlanCanvas";
import type { WorkspaceMode } from "@/types/workspace";

type WorkspaceBodyProps = {
  mode: WorkspaceMode;
};

export default function WorkspaceBody({ mode }: WorkspaceBodyProps) {
  return (
    <section className="workspace-body">
      <PlanCanvas />
      <RightPanel mode={mode} />
    </section>
  );
}

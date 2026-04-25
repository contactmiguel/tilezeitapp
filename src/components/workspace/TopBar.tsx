
type TopBarProps = {
  projectName: string;
  onProjectNameChange: (name: string) => void;
};

export default function TopBar({
  projectName,
  onProjectNameChange,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <input
          className="project-name-input"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          aria-label="Project name"
        />
      </div>


    </header>
  );
}

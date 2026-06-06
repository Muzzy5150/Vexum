import * as React from 'react';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface Workspace {
  id: string;
  name: string;
  [key: string]: any;
}

interface WorkspaceContextValue<T extends Workspace> {
  open: boolean;
  setOpen: (open: boolean) => void;
  selectedWorkspace: T | undefined;
  workspaces: T[];
  onWorkspaceSelect: (workspace: T) => void;
  getWorkspaceId: (workspace: T) => string;
  getWorkspaceName: (workspace: T) => string;
}

const WorkspaceContext = React.createContext<WorkspaceContextValue<any> | null>(null);

function useWorkspaceContext<T extends Workspace>() {
  const context = React.useContext(WorkspaceContext) as WorkspaceContextValue<T> | null;
  if (!context) throw new Error('Workspace components must be used within WorkspaceProvider');
  return context;
}

interface WorkspaceProviderProps<T extends Workspace> {
  children: React.ReactNode;
  workspaces: T[];
  selectedWorkspaceId?: string;
  onWorkspaceChange?: (workspace: T) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  getWorkspaceId?: (workspace: T) => string;
  getWorkspaceName?: (workspace: T) => string;
}

function WorkspaceProvider<T extends Workspace>({
  children, workspaces, selectedWorkspaceId, onWorkspaceChange,
  open: controlledOpen, onOpenChange,
  getWorkspaceId = (ws) => ws.id,
  getWorkspaceName = (ws) => ws.name,
}: WorkspaceProviderProps<T>) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const selectedWorkspace = React.useMemo(() => {
    if (!selectedWorkspaceId) return workspaces[0];
    return workspaces.find((ws) => getWorkspaceId(ws) === selectedWorkspaceId) || workspaces[0];
  }, [workspaces, selectedWorkspaceId, getWorkspaceId]);

  const handleWorkspaceSelect = React.useCallback((workspace: T) => {
    onWorkspaceChange?.(workspace);
    setOpen(false);
  }, [onWorkspaceChange, setOpen]);

  const value: WorkspaceContextValue<T> = {
    open, setOpen, selectedWorkspace, workspaces,
    onWorkspaceSelect: handleWorkspaceSelect,
    getWorkspaceId, getWorkspaceName,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      <Popover open={open} onOpenChange={setOpen}>
        {children}
      </Popover>
    </WorkspaceContext.Provider>
  );
}

interface WorkspaceTriggerProps extends React.ComponentProps<'button'> {
  renderTrigger?: (workspace: Workspace, isOpen: boolean) => React.ReactNode;
}

function WorkspaceTrigger({ className, renderTrigger, ...props }: WorkspaceTriggerProps) {
  const { open, selectedWorkspace, getWorkspaceName } = useWorkspaceContext();
  if (!selectedWorkspace) return null;

  if (renderTrigger) {
    return (
      <PopoverTrigger asChild>
        <button className={className} {...props}>{renderTrigger(selectedWorkspace, open)}</button>
      </PopoverTrigger>
    );
  }

  return (
    <PopoverTrigger asChild>
      <button
        data-state={open ? 'open' : 'closed'}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-sm',
          'bg-black/60 border-zinc-700/80 text-white',
          'hover:border-purple-500/60 hover:shadow-[0_0_0_1px_rgba(124,58,237,0.3)] transition-all',
          'focus:outline-none focus:border-purple-500 focus:shadow-[0_0_0_1px_rgba(124,58,237,0.4)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={selectedWorkspace.logo} alt={getWorkspaceName(selectedWorkspace)} />
            <AvatarFallback className="text-[10px] bg-purple-900/60 text-purple-300">
              {getWorkspaceName(selectedWorkspace).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="truncate font-mono text-sm">{getWorkspaceName(selectedWorkspace)}</span>
          {selectedWorkspace.plan && (
            <span className="ml-1 shrink-0 text-[10px] text-purple-400/70 font-mono">{selectedWorkspace.plan}</span>
          )}
        </div>
        <ChevronsUpDownIcon className="h-4 w-4 shrink-0 text-zinc-500" />
      </button>
    </PopoverTrigger>
  );
}

interface WorkspaceContentProps extends React.ComponentProps<typeof PopoverContent> {
  renderWorkspace?: (workspace: Workspace, isSelected: boolean) => React.ReactNode;
  title?: string;
  searchable?: boolean;
  onSearch?: (query: string) => void;
}

function WorkspaceContent({
  className, children, renderWorkspace, title = 'Workspaces',
  searchable = false, onSearch, ...props
}: WorkspaceContentProps) {
  const { workspaces, selectedWorkspace, onWorkspaceSelect, getWorkspaceId, getWorkspaceName } = useWorkspaceContext();
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredWorkspaces = React.useMemo(() => {
    if (!searchQuery) return workspaces;
    return workspaces.filter((ws) => getWorkspaceName(ws).toLowerCase().includes(searchQuery.toLowerCase()));
  }, [workspaces, searchQuery, getWorkspaceName]);

  React.useEffect(() => { onSearch?.(searchQuery); }, [searchQuery, onSearch]);

  const defaultRenderWorkspace = (workspace: Workspace, isSelected: boolean) => (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarImage src={workspace.logo} alt={getWorkspaceName(workspace)} />
        <AvatarFallback className="text-[10px] bg-purple-900/60 text-purple-300">
          {getWorkspaceName(workspace).charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <span className="truncate text-sm font-mono text-white">{getWorkspaceName(workspace)}</span>
        {workspace.plan && (
          <span className="text-[10px] text-purple-400/70 font-mono">{workspace.plan}</span>
        )}
      </div>
      {isSelected && <CheckIcon className="ml-auto h-4 w-4 text-purple-400" />}
    </div>
  );

  return (
    <PopoverContent
      className={cn(
        'p-0 border-zinc-700/80 bg-zinc-950 shadow-[0_0_24px_rgba(124,58,237,0.15)]',
        className,
      )}
      align={props.align || 'start'}
      {...props}
    >
      <div className="border-b border-zinc-800 px-3 py-2">
        <p className="text-xs font-mono tracking-wider text-purple-400 uppercase">{title}</p>
      </div>

      {searchable && (
        <div className="border-b border-zinc-800 px-3 py-2">
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border-none bg-transparent text-sm text-white placeholder:text-zinc-600 outline-none font-mono"
          />
        </div>
      )}

      <div className="max-h-[280px] overflow-y-auto">
        {filteredWorkspaces.length === 0 ? (
          <div className="px-3 py-3 text-center text-sm text-zinc-500 font-mono">No agents found</div>
        ) : (
          <div className="p-1">
            {filteredWorkspaces.map((workspace) => {
              const isSelected = selectedWorkspace && getWorkspaceId(selectedWorkspace) === getWorkspaceId(workspace);
              return (
                <button
                  key={getWorkspaceId(workspace)}
                  onClick={() => onWorkspaceSelect(workspace)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm',
                    'hover:bg-purple-500/10 hover:text-white transition-colors',
                    'focus:outline-none',
                    isSelected && 'bg-purple-500/15',
                  )}
                >
                  {renderWorkspace ? renderWorkspace(workspace, !!isSelected) : defaultRenderWorkspace(workspace, !!isSelected)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {children && (
        <>
          <div className="border-t border-zinc-800" />
          <div className="p-1">{children}</div>
        </>
      )}
    </PopoverContent>
  );
}

export { WorkspaceProvider as Workspaces, WorkspaceTrigger, WorkspaceContent };

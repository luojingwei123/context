/**
 * Context Plugin — Prompt Hook
 *
 * Injects SPACE.md + TEAM.md + TASK.md into every agent's system prompt
 * when the session is associated with a group that has a Context space.
 */

const CTX_BASE = "http://localhost:3100";

/**
 * Fetch the protocol files for a given channel + groupId
 */
export async function fetchProtocol(channel: string, groupId: string): Promise<{ space: string; team: string; task: string } | null> {
  try {
    // First, look up the space
    const lookupRes = await fetch(
      `${CTX_BASE}/api/spaces/lookup?channel=${encodeURIComponent(channel)}&groupId=${encodeURIComponent(groupId)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!lookupRes.ok) return null;
    const { space } = await lookupRes.json() as any;
    if (!space?.id) return null;

    // Then fetch all three protocol files
    const protocolRes = await fetch(
      `${CTX_BASE}/api/spaces/${space.id}/protocol`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!protocolRes.ok) return null;
    return await protocolRes.json() as any;
  } catch {
    return null;
  }
}

/**
 * Build the system prompt injection from protocol files.
 */
export function buildPromptInjection(protocol: { space: string; team: string; task: string }, spaceId: string): string {
  const sections: string[] = [];

  sections.push(`## Context Space (Shared Collaboration Protocol)`);
  sections.push(``);
  sections.push(`You are participating in a shared Context space. The following protocol files define how this team collaborates.`);
  sections.push(`All your work output MUST be written to this shared space, NOT to your local workspace.`);
  sections.push(`When sharing files, always use the Context URL format: ${CTX_BASE}/ctx/${spaceId}/<file_path>`);
  sections.push(``);

  if (protocol.space) {
    sections.push(`### SPACE.md (What this space is for)`);
    sections.push(protocol.space);
    sections.push(``);
  }

  if (protocol.team) {
    sections.push(`### TEAM.md (Who's on the team)`);
    sections.push(protocol.team);
    sections.push(``);
  }

  if (protocol.task) {
    sections.push(`### TASK.md (Current tasks)`);
    sections.push(protocol.task);
    sections.push(``);
  }

  sections.push(`### Context Tools Available`);
  sections.push(`- \`context_read_file\` — Read any file from the shared space`);
  sections.push(`- \`context_write_file\` — Write/update a file in the shared space`);
  sections.push(`- \`context_list_files\` — List files in the shared space`);
  sections.push(`- \`context_update_task\` — Update TASK.md with progress`);
  sections.push(``);

  return sections.join("\n");
}

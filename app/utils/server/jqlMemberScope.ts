function parseMemberList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

export function getRegisteredMembers(
  registeredMembers = process.env.REGISTERED_MEMBERS,
  teamMembers = process.env.TEAM_MEMBERS,
): string[] {
  const registered = parseMemberList(registeredMembers);
  return registered.length > 0 ? registered : parseMemberList(teamMembers);
}

function buildAssigneeClause(members: string[]): string {
  return `assignee in (${members.map(m => `"${m}"`).join(', ')})`;
}

function insertAssigneeClause(jql: string, members: string[]): string {
  const clause = buildAssigneeClause(members);
  const orderBy = /\sORDER BY\s/i.exec(jql);
  if (orderBy?.index != null) {
    return `${jql.slice(0, orderBy.index)} AND ${clause}${jql.slice(orderBy.index)}`;
  }
  return `${jql} AND ${clause}`;
}

function parseJqlAssignees(jql: string): string[] | null {
  const inMatch = jql.match(/\bassignee\s+in\s*\(([^)]*)\)/i);
  if (inMatch) {
    return inMatch[1]
      .split(',')
      .map(s => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  const eqMatch = jql.match(/\bassignee\s*=\s*["']([^"']+)["']/i);
  if (eqMatch) return [eqMatch[1]];

  return /\bassignee\b/i.test(jql) ? null : [];
}

export function applyRegisteredMemberScope(
  jql: string,
  roster = getRegisteredMembers(),
): string {
  if (roster.length === 0) return jql;

  const selected = parseJqlAssignees(jql);
  if (selected == null) return jql;

  const scoped = selected.length > 0
    ? selected.filter(name => roster.includes(name))
    : roster;
  const members = scoped.length > 0 ? scoped : roster;

  if (selected.length > 0) {
    const nextClause = buildAssigneeClause(members);
    const replacedIn = jql.replace(/\bassignee\s+in\s*\([^)]*\)/i, nextClause);
    if (replacedIn !== jql) return replacedIn;
    const replacedEq = jql.replace(/\bassignee\s*=\s*["'][^"']+["']/i, nextClause);
    if (replacedEq !== jql) return replacedEq;
  }

  if (/\bassignee\b/i.test(jql)) return jql;
  return insertAssigneeClause(jql, members);
}

export function injectRegisteredMemberScope(targetUrl: string): string {
  let url: URL;
  try {
    url = new URL(targetUrl);
  } catch {
    return targetUrl;
  }

  if (!url.pathname.includes('/search/jql')) return targetUrl;

  const jql = url.searchParams.get('jql');
  if (!jql) return targetUrl;

  const nextJql = applyRegisteredMemberScope(jql);
  if (nextJql === jql) return targetUrl;

  url.searchParams.set('jql', nextJql);
  return url.toString();
}

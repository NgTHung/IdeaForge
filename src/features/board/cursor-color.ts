export function cursorColorForMember(memberId: string) {
  let hash = 2166136261;
  for (const character of memberId) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `hsl(${(hash >>> 0) % 360} 74% 42%)`;
}

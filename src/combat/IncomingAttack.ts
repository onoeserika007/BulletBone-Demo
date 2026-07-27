export interface IncomingAttack {
  id: number;
  sourceX: number;
  sourceY: number;
  damage: number;
  kind: 'melee' | 'laser';
}

import type { Maneuver } from '../lib/valhalla'
import { fmtKm } from '../lib/format'

interface Props {
  maneuvers: Maneuver[]
  onPick: (shapeIndex: number) => void
}

function icon(type: number): string {
  if (type === 1 || type === 2 || type === 3) return '●'
  if (type >= 4 && type <= 6) return '◆'
  if (type === 8 || type === 17 || type === 18 || type === 23) return '↑'
  if (type === 9 || type === 10 || type === 19 || type === 20 || type === 24) return '↗'
  if (type === 11 || type === 22) return '→'
  if (type === 12) return '↘'
  if (type === 13 || type === 14) return '↩'
  if (type === 15) return '↙'
  if (type === 16 || type === 21) return '←'
  if (type === 25) return '↖'
  if (type === 26 || type === 27) return '↻'
  if (type === 28 || type === 29) return '⛴'
  return '•'
}

export function Maneuvers({ maneuvers, onPick }: Props) {
  return (
    <ol className="steps" aria-label="Yol tarifi">
      {maneuvers.map((m, i) => (
        <li key={i}>
          <button type="button" onClick={() => onPick(m.begin_shape_index)}>
            <span className="ico" aria-hidden="true">{icon(m.type)}</span>
            <span className="txt">{m.instruction}</span>
            <span className="dist">{m.length > 0 ? fmtKm(m.length) : ''}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

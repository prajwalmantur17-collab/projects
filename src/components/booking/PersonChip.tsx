import { useAvatarUrls } from '../../hooks/useAvatarUrls'
import { Avatar } from '../ui/Avatar'

/** A small round photo (or first letter) with a name, for booking cards. */
export function PersonChip({
  userId,
  name,
  label,
  className = '',
}: {
  userId: string
  name?: string | null
  /** Text shown next to the photo; defaults to the name. */
  label?: string
  className?: string
}) {
  const urls = useAvatarUrls([userId])
  return (
    <p className={`flex items-center gap-2 text-sm font-semibold text-ink-soft ${className}`}>
      <Avatar url={urls[userId]} name={name} size="sm" />
      <span className="truncate">{label ?? name}</span>
    </p>
  )
}

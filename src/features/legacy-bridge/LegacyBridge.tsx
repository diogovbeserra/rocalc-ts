import { appConfig } from '../../shared/config/app-config'
import '../../App.css'

export function LegacyBridge() {
  return (
    <main className="app-shell" aria-label="ROCalc Legacy Bridge">
      <iframe
        className="legacy-frame"
        src={appConfig.legacyEntryUrl}
        title="ROCalc Legacy App"
      />
    </main>
  )
}

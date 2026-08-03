import streamDeck from "@elgato/streamdeck"
import { loadSecrets } from "streamdeck-secrets"
import { CiStatus } from "./actions/ci-status"
import { SearchCount } from "./actions/search-count"

// The Stream Deck app launches plugins with the login environment, not a
// shell's — so tokens have to come off disk before any action reads them.
loadSecrets()

streamDeck.actions.registerAction(new SearchCount())
streamDeck.actions.registerAction(new CiStatus())

streamDeck.connect()

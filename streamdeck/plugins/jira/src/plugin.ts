import streamDeck from "@elgato/streamdeck"
import { loadSecrets } from "streamdeck-secrets"
import { JqlCount } from "./actions/jql-count"

// The Stream Deck app launches plugins with the login environment, not a
// shell's — so tokens have to come off disk before any action reads them.
loadSecrets()

streamDeck.actions.registerAction(new JqlCount())

streamDeck.connect()

import streamDeck from "@elgato/streamdeck"
import { loadSecrets } from "streamdeck-secrets"
import { RunCommand } from "./actions/run-command"

// The Stream Deck app launches plugins with the login environment, not a
// shell's — so tokens have to come off disk before any command inherits them.
loadSecrets()

streamDeck.actions.registerAction(new RunCommand())

streamDeck.connect()

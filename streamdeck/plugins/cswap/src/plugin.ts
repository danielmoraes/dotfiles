import streamDeck from "@elgato/streamdeck"
import { Accounts } from "./actions/accounts"

// No `loadSecrets()` here, unlike the other plugins: cswap holds its own OAuth
// tokens in the macOS Keychain and needs nothing from `secrets.env`.
streamDeck.actions.registerAction(new Accounts())

streamDeck.connect()

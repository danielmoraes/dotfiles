import streamDeck from "@elgato/streamdeck"
import { loadSecrets } from "streamdeck-secrets"
import { NextMeeting } from "./actions/next-meeting"

// The Stream Deck app launches plugins with the login environment, not a
// shell's — so tokens have to come off disk before any action reads them.
loadSecrets()

streamDeck.actions.registerAction(new NextMeeting())

streamDeck.connect()

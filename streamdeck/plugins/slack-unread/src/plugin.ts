import streamDeck from "@elgato/streamdeck"
import { loadSecrets } from "streamdeck-secrets"
import { SlackStatus } from "./actions/slack-status"
import { UnreadCount } from "./actions/unread-count"

// The Stream Deck app launches plugins with the login environment, not a
// shell's — so tokens have to come off disk before any action reads them.
loadSecrets()

streamDeck.actions.registerAction(new UnreadCount())
streamDeck.actions.registerAction(new SlackStatus())

streamDeck.connect()

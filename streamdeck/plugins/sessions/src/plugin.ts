import streamDeck from "@elgato/streamdeck"
import { Slot } from "./actions/slot"

// No `loadSecrets()` here: the only thing this plugin talks to is the AgentDeck
// daemon on loopback, which needs no credential of ours.
streamDeck.actions.registerAction(new Slot())

streamDeck.connect()

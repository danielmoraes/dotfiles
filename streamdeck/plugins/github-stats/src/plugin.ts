import streamDeck from "@elgato/streamdeck"
import { CiStatus } from "./actions/ci-status"
import { SearchCount } from "./actions/search-count"

streamDeck.actions.registerAction(new SearchCount())
streamDeck.actions.registerAction(new CiStatus())

streamDeck.connect()

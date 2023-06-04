# Setup fzf
# ---------
if [[ ! "$PATH" == */home/moraes/.fzf/bin* ]]; then
  export PATH="${PATH:+${PATH}:}/home/moraes/.fzf/bin"
fi

# Auto-completion
# ---------------
[[ $- == *i* ]] && source "/home/moraes/.fzf/shell/completion.zsh" 2> /dev/null

# Key bindings
# ------------
source "/home/moraes/.fzf/shell/key-bindings.zsh"

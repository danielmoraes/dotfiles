#
# ~/.bashrc
#

# If not running interactively, don't do anything
[[ $- != *i* ]] && return

eval `ssh-agent -s`

# unset manpath so we can inherit from /etc/manpath via the `manpath` command
unset MANPATH # delete if you already modified MANPATH elsewhere in your config
export MANPATH="$NPM_PACKAGES/share/man:$(manpath)"

# colorscheme
export BACKGROUND=light

# default editor
export EDITOR=nvim
export VISUAL=nvim

# fzf
[ -f ~/.fzf.bash ] && source ~/.fzf.bash

# bash completion
# source /usr/share/bash-completion/completions/dit
# source /usr/share/bash-completion/completions/git

# alias
alias vim=nvim
alias ls='ls --color=auto'
alias reboot=/sbin/reboot
alias :vg='valgrind --leak-check=full --show-leak-kinds=all --track-origins=yes'

eval `dircolors /home/moraes/.dircolors`

# path variables

export LD_LIBRARY_PATH=/usr/local/lib
export LD_RUN_PATH=/usr/local/lib

export PATH="/home/moraes/.dotnet/tools:$PATH"
export PATH="/snap/bin:$PATH"
export PATH="/home/moraes/app/bin:$PATH"
export PATH="/home/moraes/dev/scripts:$PATH"

export GOPATH="$HOME/workspace"
export PATH="$GOPATH/bin:$PATH"

NPM_PACKAGES="${HOME}/.npm-packages"
export PATH="$NPM_PACKAGES/bin:$PATH"

export PATH="$HOME/app/google_appengine/:$PATH"

RUBY_GEMS="${HOME}/.gem/ruby/2.5.0/bin"
export PATH="${RUBY_GEMS}:$PATH"

# bash prompt

PROMPT_DIRTY_UNPUSHED_SYMBOL="↑"
PROMPT_SYNCED_SYMBOL=""
PROMPT_DIRTY_SYNCED_SYMBOL="*"
PROMPT_UNPUSHED_SYMBOL="↑"
PROMPT_DIRTY_UNPUSHED_SYMBOL="*↑"
PROMPT_UNPULLED_SYMBOL="↓"
PROMPT_DIRTY_UNPULLED_SYMBOL="*↓"
PROMPT_UNPUSHED_UNPULLED_SYMBOL="*↑↓"
PROMPT_DIRTY_UNPUSHED_UNPULLED_SYMBOL="*↑↓"
PROMPT_USER_COLOR="$(tput bold)$(tput setaf 124)"  # neutral red
if [[ "$BACKGROUND" == "light" ]]; then
  PROMPT_PREPOSITION_COLOR="$(tput setaf 235)"       # dark bg
else
  PROMPT_PREPOSITION_COLOR="$(tput setaf 229)"       # light bg
fi
PROMPT_DEVICE_COLOR="$(tput bold)$(tput setaf 66)" # neutral blue
PROMPT_DIR_COLOR="$(tput setaf 166)"               # neutral orange
PROMPT_GIT_STATUS_COLOR="$(tput setaf 132)"        # neutral purple
PROMPT_GIT_PROGRESS_COLOR="$(tput setaf 132)"      # neutral purple
PROMPT_GIT_SYMBOL_COLOR="$(tput setaf 132)"        # neutral purple
. ~/.bash_prompt

# misc

function title () {
  TITLE=$*;
  export PROMPT_COMMAND='echo -ne "\033]0;$TITLE\007"'
}

LS_COLORS=$LS_COLORS:'ow=1;34:tw=1;34:' ; export LS_COLORS

setxkbmap -layout us -variant alt-intl

NPM_PACKAGES="${HOME}/.npm-packages"
PATH="$NPM_PACKAGES/bin:$PATH"

export DOTNET_ROOT=/opt/dotnet

eval "$(pyenv init -)"

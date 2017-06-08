#
# ~/.bashrc
#

# If not running interactively, don't do anything
[[ $- != *i* ]] && return

if ! pgrep -u "$USER" ssh-agent > /dev/null; then
    ssh-agent > ~/.ssh-agent-thing
fi
if [[ "$SSH_AGENT_PID" == "" ]]; then
    eval "$(<~/.ssh-agent-thing)"
fi

# unset manpath so we can inherit from /etc/manpath via the `manpath` command
unset MANPATH # delete if you already modified MANPATH elsewhere in your config
export MANPATH="$NPM_PACKAGES/share/man:$(manpath)"

# default editor
export EDITOR=nvim
export VISUAL=nvim

# fzf
[ -f ~/.fzf.bash ] && source ~/.fzf.bash

# python virtualenv
venv() {
    local activate=~/.python/$1/bin/activate
    if [ -e "$activate" ] ; then
        source "$activate"
    else
        echo "Error: Not found: $activate"
    fi
}
venv27() { venv 27 ; }

# bash completion
source /usr/share/bash-completion/completions/dit
source /usr/share/bash-completion/completions/git

# alias
alias vim=nvim
alias ls='ls --color=auto'
alias reboot=/sbin/reboot
alias :vg='valgrind --leak-check=full --show-leak-kinds=all --track-origins=yes'

# custom functions
gf() { wget -qO- "http://www.google.com/finance/converter?a=$1&from=$2&to=$3" | sed '/res/!d;s/<[^>]*>//g'; }

eval `dircolors /home/moraes/.dircolors`

# path variables
export LD_LIBRARY_PATH=/usr/local/lib
export LD_RUN_PATH=/usr/local/lib
export GOPATH="$HOME/workspace"
NPM_PACKAGES="${HOME}/.npm-packages"
RUBY_GEMS="${HOME}/.gem/ruby/2.4.0/bin"
export PATH="/home/moraes/app/bin:$GOPATH/bin:$NPM_PACKAGES/bin:$HOME/app/google_appengine/:${RUBY_GEMS}:$PATH"

# bash prompt
PROMPT_USER_COLOR="$(tput bold)$(tput setaf 124)"  # neutral red
PROMPT_PREPOSITION_COLOR="$(tput setaf 235)"       # black
PROMPT_DEVICE_COLOR="$(tput bold)$(tput setaf 66)" # neutral blue
PROMPT_DIR_COLOR="$(tput setaf 166)"               # neutral orange
PROMPT_GIT_STATUS_COLOR="$(tput setaf 132)"        # neutral purple
PROMPT_GIT_PROGRESS_COLOR="$(tput setaf 132)"      # neutral purple
PROMPT_GIT_SYMBOL_COLOR="$(tput setaf 132)"        # neutral purple
. ~/.bash_prompt

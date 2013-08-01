let $SH_ENV = "~/.bash_profile"
set shell=/bin/bash

filetype off
filetype plugin indent on
set nocompatible

" --- BASIC OPTIONS -----------------------------------------------------------
" -----------------------------------------------------------------------------

set encoding=utf-8
set modelines=0
set autoindent
set showmode
set showcmd
set hidden
set visualbell
set ttyfast
set ruler
set backspace=indent,eol,start
set nonumber
set norelativenumber
set laststatus=2
set history=1000
set undofile
set undoreload=10000
set undolevels=1000
set list
set listchars=tab:▸\ ,eol:¬,extends:❯,precedes:❮
set lazyredraw
set matchtime=3
set showbreak=↪
set splitbelow
set splitright
set autowrite
set autoread
set shiftround
set title
set linebreak
set dictionary=/usr/share/dict/words
set spellfile=~/.vim/custom-dictionary.utf-8.add
set colorcolumn=+1

" automatic reloading of .vimrc
autocmd! bufwritepost .vimrc source %

" better copy & paste
set clipboard=unnamed

" mouse and backspace
set mouse=a  " on OSX press ALT and click
set bs=2     " make backspace behave like normal again

" leader
let mapleader = ","
let maplocalleader = "\\"

" sets the default fold method
set foldmethod=syntax
let c_no_comment_fold = 1

" better Completion
set complete=.,w,b,u,t
set completeopt=longest,menuone,preview

" resize splits when the window is resized
au VimResized * :wincmd =

" time out on key codes but not mappings
" basically this makes terminal vim work sanely
set notimeout
set ttimeout
set ttimeoutlen=10

" cursorline
" only show cursorline in the current window and in normal mode.
augroup cline
    au!
    au WinLeave,InsertEnter * set nocursorline
    au WinEnter,InsertLeave * set cursorline
augroup END

" trailing whitespace
" only shown when not in insert mode so I don't go insane.
augroup trailing
    au!
    au InsertEnter * :set listchars-=trail:⌴
augroup END

" line return
" make sure Vim returns to the same line when you reopen a file.
augroup line_return
    au!
    au BufReadPost *
        \ if line("'\"") > 0 && line("'\"") <= line("$") |
        \     execute 'normal! g`"zvzz' |
        \ endif
augroup END

" don't move around in insert mode
inoremap <up> <nop>
inoremap <down> <nop>
inoremap <left> <nop>
inoremap <right> <nop>

" show whitespace
" must be inserted before the colorscheme command
autocmd ColorScheme * highlight ExtraWhitespace ctermbg=red guibg=red
au InsertLeave * match ExtraWhitespace /\s\+$/

" color scheme
set t_Co=256
color molokai
let g:molokai_original = 1
let g:rehash256 = 1

" reload the colorscheme whenever we write the file.
augroup color_badwolf_dev
    au!
    au BufWritePost badwolf.vim color badwolf
augroup END

" enable syntax highlighting
syntax on

" don't try to highlight lines longer than 800 characters.
set synmaxcol=800

" showing line numbers and length
set number  " show line numbers
set tw=79   " width of document (used by gd)
set nowrap  " don't automatically wrap on load
set fo-=t   " don't automatically wrap text when typing
set colorcolumn=80
highlight ColorColumn ctermbg=16

" easier formatting of paragraphs
vmap Q gq
nmap Q gqap

" tabs, spaces, wrapping
set tabstop=4
set shiftwidth=4
set softtabstop=4
set expandtab
set shiftround
set wrap
set textwidth=80
set formatoptions=qrn1

" backup
set backup
set noswapfile
set undodir=~/.vim/tmp/undo//     " undo files
set backupdir=~/.vim/tmp/backup// " backups
set directory=~/.vim/tmp/swap//   " swap files

" make backup folders automatically if they don't already exist.
if !isdirectory(expand(&undodir))
    call mkdir(expand(&undodir), "p")
endif
if !isdirectory(expand(&backupdir))
    call mkdir(expand(&backupdir), "p")
endif
if !isdirectory(expand(&directory))
    call mkdir(expand(&directory), "p")
endif

" from http://vim.wikia.com/wiki/Indent_text_object
" use (motion)ai to select 'an indent' use (motion)ii to select 'inner indent'
" good for python
onoremap <silent>ai :<C-u>cal IndTxtObj(0)<CR>
onoremap <silent>ii :<C-u>cal IndTxtObj(1)<CR>
vnoremap <silent>ai :<C-u>cal IndTxtObj(0)<CR><Esc>gv
vnoremap <silent>ii :<C-u>cal IndTxtObj(1)<CR><Esc>gv

function! IndTxtObj(inner)
  let curline = line(".")
  let lastline = line("$")
  let i = indent(line(".")) - &shiftwidth * (v:count1 - 1)
  let i = i < 0 ? 0 : i
  if getline(".") !~ "^\\s*$"
    let p = line(".") - 1
    let nextblank = getline(p) =~ "^\\s*$"
    while p > 0 && ((i == 0 && !nextblank) || (i > 0 && ((indent(p) >= i && !(nextblank && a:inner)) || (nextblank && !a:inner))))
      -
      let p = line(".") - 1
      let nextblank = getline(p) =~ "^\\s*$"
    endwhile
    normal! 0V
    call cursor(curline, 0)
    let p = line(".") + 1
    let nextblank = getline(p) =~ "^\\s*$"
    while p <= lastline && ((i == 0 && !nextblank) || (i > 0 && ((indent(p) >= i && !(nextblank && a:inner)) || (nextblank && !a:inner))))
      +
      let p = line(".") + 1
      let nextblank = getline(p) =~ "^\\s*$"
    endwhile
    normal! $
  endif
endfunction

" setup pathogen to manage your plugins
" mkdir -p ~/.vim/autoload ~/.vim/bundle
" curl -so ~/.vim/autoload/pathogen.vim https://raw.github.com/tpope/vim-pathogen/HEAD/autoload/pathogen.vim
" now you can install any plugin into a .vim/bundle/plugin-name/ folder
call pathogen#infect()

" --- SEARCHING AND MOVEMENT --------------------------------------------------
" -----------------------------------------------------------------------------

" Use sane regexes.
nnoremap / /\v
vnoremap / /\v

set ignorecase
set smartcase
set incsearch
set showmatch
set hlsearch
set gdefault

set scrolloff=3
set sidescroll=1
set sidescrolloff=10

set virtualedit+=block

noremap <silent> <leader><space> :noh<cr>:call clearmatches()<cr>

" --- MAPPINGS ----------------------------------------------------------------
" -----------------------------------------------------------------------------

" panic Button
nnoremap <f9> mzggg?G`z

" open a new vim tab
noremap <c-t> :tabnew<CR>
vnoremap <c-t> :tabnew<CR>
onoremap <c-t> :tabnew<CR>

" quicksave command
noremap <c-z> :update<CR>
vnoremap <c-z> <c-c>:update<CR>
inoremap <c-z> <c-o>:update<CR>

" quick quit command
noremap <Leader>k :quit<CR>  " Quit current window
noremap <Leader>K :qa!<CR>   " Quit all windows

" bind ctrl+<movement> keys to move around the windows,
" instead of using ctrl+w + <movement>
map <c-j> <c-w>j
map <c-k> <c-w>k
map <c-l> <c-w>l
map <c-h> <c-w>h

" easier moving between tabs
map <Leader>n <esc>:tabprevious<CR>
map <Leader>m <esc>:tabnext<CR>

" sort lines
nnoremap <leader>s vip:!sort<cr>
vnoremap <leader>s :!sort<cr>


" easier moving of code blocks
" try to go into visual mode (v), then select several lines of code here and
" then press '>' several times.
vnoremap < <gv  " better indentation
vnoremap > >gv  " better indentation

" 'uppercase word' mapping.
"
" This mapping allows you to press <c-u> in insert mode to convert the current
" word to uppercase.  It's handy when you're writing names of constants and
" don't want to use Capslock.
"
" To use it you type the name of the constant in lowercase.  While your
" cursor is at the end of the word, press <c-u> to uppercase it, and then
" continue happily on your way:
"
"                            cursor
"                            v
"     max_connections_allowed|
"     <c-u>
"     MAX_CONNECTIONS_ALLOWED|
"                            ^
"                            cursor
"
" It works by exiting out of insert mode, recording the current cursor location
" in the z mark, using gUiw to uppercase inside the current word, moving back
" to the z mark, and entering insert mode again.
"
" Note that this will overwrite the contents of the z mark.  I never use it,
" but if you do you'll probably want to use another mark.
inoremap <C-u> <esc>mzgUiw`za

" html tag closing
inoremap <C-_> <space><bs><esc>:call InsertCloseTag()<cr>a

" sudo to write
cnoremap w!! w !sudo tee % >/dev/null

" toggle line numbers
nnoremap <leader>l :setlocal number!<cr>

" better navigating through omnicomplete option list
" from http://stackoverflow.com/questions/2170023/how-to-map-keys-for-popup-menu-in-vim
set completeopt=longest,menuone
function! OmniPopup(action)
    if pumvisible()
        if a:action == 'j'
            return "\<C-N>"
        elseif a:action == 'k'
            return "\<C-P>"
        endif
    endif
    return a:action
endfunction

inoremap <silent><C-j> <C-R>=OmniPopup('j')<CR>
inoremap <silent><C-k> <C-R>=OmniPopup('k')<CR>

" --- FILETYPE-SPECIFIC -------------------------------------------------------
" -----------------------------------------------------------------------------

" --- C ---

augroup ft_c
    au!
    au FileType c setlocal foldmethod=marker foldmarker={,}
augroup END

" --- CSS ---

augroup ft_css
    au!

    au BufNewFile,BufRead *.less setlocal filetype=less

    au Filetype less,css setlocal foldmethod=marker
    au Filetype less,css setlocal foldmarker={,}
    au Filetype less,css setlocal omnifunc=csscomplete#CompleteCSS
    au Filetype less,css setlocal iskeyword+=-

    " Use <leader>S to sort properties.  Turns this:
    "
    "     p {
    "         width: 200px;
    "         height: 100px;
    "         background: red;
    "
    "         ...
    "     }
    "
    " into this:

    "     p {
    "         background: red;
    "         height: 100px;
    "         width: 200px;
    "
    "         ...
    "     }
    au BufNewFile,BufRead *.less,*.css nnoremap <buffer> <localleader>S ?{<CR>jV/\v^\s*\}?$<CR>k:sort<CR>:noh<CR>

    " Make {<cr> insert a pair of brackets in such a way that the cursor is correctly
    " positioned inside of them AND the following code doesn't get unfolded.
    au BufNewFile,BufRead *.less,*.css inoremap <buffer> {<cr> {}<left><cr><space><space><space><space>.<cr><esc>kA<bs>
augroup END

" --- JAVASCRIPT ---

augroup ft_javascript
    au!

    au FileType javascript setlocal foldmethod=marker
    au FileType javascript setlocal foldmarker={,}
    au FileType javascript call MakeSpacelessBufferIabbrev('clog', 'console.log();<left><left>')

    " Make {<cr> insert a pair of brackets in such a way that the cursor is correctly
    " positioned inside of them AND the following code doesn't get unfolded.
    au Filetype javascript inoremap <buffer> {<cr> {}<left><cr><space><space><space><space>.<cr><esc>kA<bs>
augroup END

" --- PYTHON ---

" python folding
" mkdir -p ~/.vim/ftplugin
" wget -O ~/.vim/ftplugin/python_editing.vim http://www.vim.org/scripts/download_script.php?src_id=5492
set nofoldenable

augroup ft_python
    au!

    au FileType python setlocal define=^\s*\\(def\\\\|class\\)
    au FileType man nnoremap <buffer> <cr> :q<cr>

    " Jesus tapdancing Christ, built-in Python syntax, you couldn't let me
    " override this in a normal way, could you?
    au FileType python if exists("python_space_error_highlight") | unlet python_space_error_highlight | endif

    au FileType python iabbrev <buffer> afo assert False, "Okay"
augroup END

" --- PLUGIN SETTINGS ---------------------------------------------------------
" -----------------------------------------------------------------------------

" settings for vim-powerline
" cd ~/.vim/bundle
" git clone git://github.com/Lokaltog/vim-powerline.git
set laststatus=2

" settings for ctrlp
" cd ~/.vim/bundle
" git clone https://github.com/kien/ctrlp.vim.git
let g:ctrlp_max_height = 30
set wildignore+=*.pyc
set wildignore+=*_build/*
set wildignore+=*/coverage/*

" settings for python-mode
" cd ~/.vim/bundle
" git clone https://github.com/klen/python-mode
map <Leader>g :call RopeGotoDefinition()<CR>
let ropevim_enable_shortcuts = 1
let g:pymode_rope_goto_def_newwin = "vnew"
let g:pymode_rope_extended_complete = 1
let g:pymode_breakpoint = 0
let g:pymode_syntax = 1
let g:pymode_syntax_builtin_objs = 0
let g:pymode_syntax_builtin_funcs = 0
let g:pymode_lint_ignore = "C901,E0602"
let g:pymode_lint_onfly = 1
map <Leader>b Oimport ipdb; ipdb.set_trace() # BREAKPOINT<C-c>

" # vim-plug
" ------------------------------------------------------------------------------

" directory for plugins
call plug#begin('~/.config/nvim/plugged')

Plug 'sheerun/vim-polyglot'
Plug 'scrooloose/nerdtree'
Plug 'vim-airline/vim-airline'
Plug 'junegunn/fzf', { 'dir': '~/.fzf', 'do': './install --all' }
Plug 'junegunn/fzf.vim'
Plug 'morhetz/gruvbox'
Plug 'w0rp/ale'
Plug 'Shougo/deoplete.nvim', { 'do': ':UpdateRemotePlugins' }
Plug 'zchee/deoplete-clang'
Plug 'carlitux/deoplete-ternjs', { 'do': 'npm install -g tern' }
Plug 'ervandew/supertab'
Plug 'jreybert/vimagit'

" initialize plugin system
call plug#end()

" # basic settings
" ------------------------------------------------------------------------------

set nocompatible
filetype off
set fillchars+=vert:\|
filetype plugin on

" leader
let mapleader = ","
let maplocalleader = "\\"

" line number
set relativenumber
set number

" markers
set list
set listchars=tab:▸\ ,extends:❯,precedes:❮

" 80 column mark
set colorcolumn=81

" true colors support
set termguicolors

" show whitespace
" must be inserted before the colorscheme command
autocmd ColorScheme * highlight ExtraWhitespace ctermbg=red guibg=red
au InsertLeave * match ExtraWhitespace /\s\+$/

" color scheme
set background=light
let g:gruvbox_italic=1
colorscheme gruvbox

" airline color scheme
let g:airline_theme='gruvbox'

" undo settings
set history=1000
set undofile
set undoreload=1000
set undolevels=1000
set undodir=~/.config/nvim/undo
set noswapfile
if !isdirectory(expand(&undodir))
  call mkdir(expand(&undodir), "p")
endif

" tabs, spaces, wrapping
set tabstop=2
set shiftwidth=2
set softtabstop=2
set expandtab
set shiftround

" don't move around in insert mode
inoremap <up> <nop>
inoremap <down> <nop>
inoremap <left> <nop>
inoremap <right> <nop>

" return to the same line when you reopen a file
augroup line_return
  au!
  au BufReadPost *
    \ if line("'\"") > 0 && line("'\"") <= line("$") |
    \   execute 'normal! g`"zvzz' |
    \ endif
augroup END

" deoplete
let g:deoplete#enable_at_startup = 1
let g:tern_request_timeout = 1
let g:tern_show_signature_in_pum = '0' " disable full signature type
let g:tern#command = ["tern"]
let g:tern#arguments = ["--persistent"]
let g:tern#filetypes = ['jsx', 'javascript.jsx', 'vue']
set completeopt-=preview
let g:deoplete#sources#clang#libclang_path = '/usr/lib/libclang.so'
let g:deoplete#sources#clang#clang_header = '/usr/lib/clang'

" ale
let g:ale_linters = {'c': [], 'cpp': []}

" # searching / movement
" ------------------------------------------------------------------------------

" use sane regexes
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

" clear search matches
noremap <silent> <leader><space> :noh<cr>:call clearmatches()<cr>

" # mappings
" ------------------------------------------------------------------------------

" open a new vim tab
noremap <c-t> :tabnew<CR>
vnoremap <c-t> :tabnew<CR>
onoremap <c-t> :tabnew<CR>

" easier moving between tabs
map <Leader>n <esc>:tabprevious<CR>
map <Leader>m <esc>:tabnext<CR>

" sort lines
nnoremap <leader>s vip:!sort<cr>
vnoremap <leader>s :!sort<cr>

" nerdtree
map <F2> :NERDTreeToggle<CR>

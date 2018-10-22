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
Plug 'editorconfig/editorconfig-vim'
Plug 'Yggdroot/indentLine'
Plug 'scrooloose/nerdcommenter'
Plug 'airblade/vim-gitgutter'
Plug 'tpope/vim-abolish'
Plug 'tpope/vim-surround'
Plug 'chrisbra/Colorizer'
Plug 'godlygeek/tabular'
Plug 'gcmt/taboo.vim'
Plug 'edkolev/tmuxline.vim'
Plug 'filipelbc/orgmode.vim'
Plug 'tpope/vim-speeddating'
Plug 'ryanoasis/vim-devicons'
Plug 'Chiel92/vim-autoformat'

" initialize plugin system
call plug#end()

" # basic settings
" ------------------------------------------------------------------------------

set nocompatible
set fillchars+=vert:\|
set encoding=UTF-8
filetype off
filetype plugin on
filetype indent on

set foldmethod=syntax
set foldlevelstart=20

set clipboard=unnamed

" leader
let mapleader = ","
let maplocalleader = "\\"

" mouse and backspace
set mouse=a  " on OSX press ALT and click
set bs=2     " make backspace behave like normal again

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
let bg=$BACKGROUND
execute "set background=".bg
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

" Copy to clipboard
vnoremap  <leader>y  "+y
nnoremap  <leader>Y  "+yg_
nnoremap  <leader>y  "+y
nnoremap  <leader>yy  "+yy

" Paste from clipboard
nnoremap <leader>p "+p
nnoremap <leader>P "+P
vnoremap <leader>p "+p
vnoremap <leader>P "+P

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
let g:ale_linters = {'javascript': ['eslint'], 'python': ['flake8']}

" let g:ale_python_flake8_executable = 'python3'
" let g:ale_python_flake8_options = '-m flake8'

" nerdcommenter
let g:NERDSpaceDelims = 1
let g:NERDCompactSexyComs = 1
let g:NERDDefaultAlign = 'left'

" vim-polyglot
let g:vim_markdown_conceal = 0

let g:tmuxline_powerline_separators = 0

" vim-autoformat
let g:formatdef_orgformat_org = '"orgformat -"'
let g:formatters_org = ['orgformat_org']

" indentLine
let g:indentLine_concealcursor = ''
let g:indentLine_conceallevel = 2

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

" easier moving of code blocks
" try to go into visual mode (v), then select several lines of code here and
" then press '>' several times.
vnoremap < <gv  " better indentation
vnoremap > >gv  " better indentation

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

" orgmode.vim
map <leader>h :OrgExportToHTML<cr>

-------------------------------
--  "Zenburn" awesome theme  --
--    By Adrian C. (anrxc)   --
-------------------------------

-- {{{ Main
local theme = {}
theme.wallpaper = os.getenv("HOME") .. "/media/img/wallpapers/solarized_light_arch_4k_updated.jpg"
-- theme.wallpaper = os.getenv("HOME") .. "/media/img/wallpapers/wasitalladream.jpg"
theme.wallpaper_v = os.getenv("HOME") .. "/media/img/wallpapers/solarized_light_arch_4k_vertical_updated.jpg"
-- }}}

-- {{{ Functions
local function scale()
   local xrdb = io.popen("xrdb -query")
   if xrdb then
      for line in xrdb:lines() do
     output = line:match("^Xft.dpi:\t(%d+)$")
     if output then
            xrdb:close()
        return tonumber(output)/96
     end
      end
      xrdb:close()
   end
   return 1
end
-- }}}

-- {{{ Styles
--
theme.scale     = scale()
theme.font      = "Terminus " .. 4.5 * theme.scale

-- {{{ Colors
theme.colors = {}
theme.colors.base03  = "#002B36"
theme.colors.base02  = "#073642"
theme.colors.base01  = "#586E75"
theme.colors.base00  = "#657b83"
theme.colors.base0   = "#839496"
theme.colors.base1   = "#93A1A1"
theme.colors.base2   = "#EEE8D5"
theme.colors.base3   = "#FDf6E3"
theme.colors.yellow  = "#B58900"
theme.colors.orange  = "#CB4B16"
theme.colors.red     = "#DC322F"
theme.colors.magenta = "#D33682"
theme.colors.violet  = "#6C71C4"
theme.colors.blue    = "#268BD2"
theme.colors.cyan    = "#2AA198"
theme.colors.green   = "#859900"
theme.fg_normal  = theme.colors.base01
theme.fg_focus   = theme.colors.base03
theme.fg_urgent  = theme.colors.red
theme.bg_normal  = theme.colors.base3
theme.bg_focus   = theme.colors.base2
theme.bg_urgent  = theme.colors.base2
theme.bg_systray = theme.bg_normal
-- }}}

-- {{{ Borders
theme.useless_gap   = 0
theme.border_width  = 1
theme.border_normal = theme.colors.base1
theme.border_focus  = theme.colors.base03
theme.border_marked = theme.colors.red
-- }}}

-- {{{ Titlebars
theme.titlebar_bg_focus  = theme.colors.base02
theme.titlebar_bg_normal = theme.colors.base02
-- }}}

-- There are other variable sets
-- overriding the default one when
-- defined, the sets are:
-- [taglist|tasklist]_[bg|fg]_[focus|urgent]
-- titlebar_[normal|focus]
-- tooltip_[font|opacity|fg_color|bg_color|border_width|border_color]
-- Example:
--theme.taglist_bg_focus = "#CC9393"
-- }}}

-- {{{ Widgets
-- You can add as many variables as
-- you wish and access them by using
-- beautiful.variable in your rc.lua
--theme.fg_widget        = "#AECF96"
--theme.fg_center_widget = "#88A175"
--theme.fg_end_widget    = "#FF5656"
--theme.bg_widget        = "#494B4F"
--theme.border_widget    = "#3F3F3F"
-- }}}

-- {{{ Mouse finder
theme.mouse_finder_color = "#CC9393"
-- mouse_finder_[timeout|animate_timeout|radius|factor]
-- }}}

-- {{{ Menu
-- Variables set for theming the menu:
-- menu_[bg|fg]_[normal|focus]
-- menu_[border_color|border_width]
theme.menu_height = 16
theme.menu_width  = 140
-- }}}

-- {{{ Icons
-- {{{ Taglist
theme.taglist_squares_sel   = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/taglist/squarefz.png"
theme.taglist_squares_unsel = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/taglist/squarez.png"
--theme.taglist_squares_resize = "false"
-- }}}

-- {{{ Misc
theme.awesome_icon           = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/awesome-icon.png"
theme.menu_submenu_icon      = os.getenv("HOME") .. "/.config/awesome/themes/default/submenu.png"
-- }}}

-- {{{ Layout
theme.layout_tile       = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/tile.png"
theme.layout_tileleft   = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/tileleft.png"
theme.layout_tilebottom = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/tilebottom.png"
theme.layout_tiletop    = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/tiletop.png"
theme.layout_fairv      = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/fairv.png"
theme.layout_fairh      = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/fairh.png"
theme.layout_spiral     = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/spiral.png"
theme.layout_dwindle    = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/dwindle.png"
theme.layout_max        = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/max.png"
theme.layout_fullscreen = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/fullscreen.png"
theme.layout_magnifier  = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/magnifier.png"
theme.layout_floating   = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/floating.png"
theme.layout_cornernw   = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/cornernw.png"
theme.layout_cornerne   = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/cornerne.png"
theme.layout_cornersw   = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/cornersw.png"
theme.layout_cornerse   = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/layouts/cornerse.png"
-- }}}

-- {{{ Titlebar
theme.titlebar_close_button_focus  = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/close_focus.png"
theme.titlebar_close_button_normal = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/close_normal.png"

theme.titlebar_minimize_button_normal = os.getenv("HOME") .. "/.config/awesome/themes/default/titlebar/minimize_normal.png"
theme.titlebar_minimize_button_focus  = os.getenv("HOME") .. "/.config/awesome/themes/default/titlebar/minimize_focus.png"

theme.titlebar_ontop_button_focus_active  = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/ontop_focus_active.png"
theme.titlebar_ontop_button_normal_active = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/ontop_normal_active.png"
theme.titlebar_ontop_button_focus_inactive  = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/ontop_focus_inactive.png"
theme.titlebar_ontop_button_normal_inactive = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/ontop_normal_inactive.png"

theme.titlebar_sticky_button_focus_active  = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/sticky_focus_active.png"
theme.titlebar_sticky_button_normal_active = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/sticky_normal_active.png"
theme.titlebar_sticky_button_focus_inactive  = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/sticky_focus_inactive.png"
theme.titlebar_sticky_button_normal_inactive = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/sticky_normal_inactive.png"

theme.titlebar_floating_button_focus_active  = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/floating_focus_active.png"
theme.titlebar_floating_button_normal_active = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/floating_normal_active.png"
theme.titlebar_floating_button_focus_inactive  = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/floating_focus_inactive.png"
theme.titlebar_floating_button_normal_inactive = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/floating_normal_inactive.png"

theme.titlebar_maximized_button_focus_active  = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/maximized_focus_active.png"
theme.titlebar_maximized_button_normal_active = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/maximized_normal_active.png"
theme.titlebar_maximized_button_focus_inactive  = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/maximized_focus_inactive.png"
theme.titlebar_maximized_button_normal_inactive = os.getenv("HOME") .. "/.config/awesome/themes/zenburn/titlebar/maximized_normal_inactive.png"
-- }}}
-- }}}

return theme

-- vim: filetype=lua:expandtab:shiftwidth=4:tabstop=8:softtabstop=4:textwidth=80

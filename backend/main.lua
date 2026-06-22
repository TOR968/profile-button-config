local logger = require("logger")
local millennium = require("millennium")

local function plugin_dir()
    local src = debug.getinfo(1, "S").source or ""
    if src:sub(1, 1) == "@" then
        src = src:sub(2)
    end
    src = src:gsub("\\", "/")
    return src:match("^(.+)/backend/") or "."
end

local SETTINGS_FILE = plugin_dir() .. "/settings.json"

local function read_file(path)
    local f = io.open(path, "r")
    if not f then
        return nil
    end
    local body = f:read("*a")
    f:close()
    return body
end

local function write_file(path, content)
    local f = io.open(path, "w")
    if not f then
        return false
    end
    f:write(content)
    f:close()
    return true
end

function GetSettings()
    return read_file(SETTINGS_FILE) or "{}"
end

function SaveSettings(settings_json)
    if type(settings_json) ~= "string" or settings_json == "" then
        return "0"
    end
    if write_file(SETTINGS_FILE, settings_json) then
        return "1"
    end
    return "0"
end

local function on_load()
    millennium.ready()
    logger:info("plugin loaded; settings file: " .. SETTINGS_FILE)
end

local function on_unload()
    logger:info("plugin unloaded")
end

local function on_frontend_loaded()
end

return {
    on_frontend_loaded = on_frontend_loaded,
    on_load = on_load,
    on_unload = on_unload,
    GetSettings = GetSettings,
    SaveSettings = SaveSettings
}

# coding=utf-8
from __future__ import absolute_import

import flask
import logging
import logging.handlers
import os
import requests
import xmltodict
import tempfile
import threading
import shutil
import time
import octoprint.plugin

import octoprint.server.util.flask
from octoprint.server import admin_permission, NO_CONTENT
from octoprint.events import Events
from octoprint.util import CaseInsensitiveSet, dict_merge

from past.builtins import basestring


class FlashSailfishPlugin(octoprint.plugin.BlueprintPlugin,
                          octoprint.plugin.TemplatePlugin,
                          octoprint.plugin.AssetPlugin,
                          octoprint.plugin.SettingsPlugin,
                          octoprint.plugin.EventHandlerPlugin):
    """OctoPrint plugin for flashing Sailfish firmware."""

    def __init__(self, *args, **kwargs):
        """Initialize the FlashSailfishPlugin."""
        self.xml = None
        self.firmware_info = None

    @octoprint.plugin.BlueprintPlugin.errorhandler(Exception)
    def errorhandler(self, error):
        """Handle unhandled exceptions and log them."""
        self._logger.exception(error)
        return error

    @octoprint.plugin.BlueprintPlugin.route("/firmware_info", methods=["GET"])
    @octoprint.server.util.flask.restricted_access
    @octoprint.server.admin_permission.require(403)
    def get_firmware_info(self, *args, **kwargs):
        """Get firmware information."""
        return self._firmware_info()

    @octoprint.plugin.BlueprintPlugin.route("/firmware_file", methods=["POST"])
    @octoprint.server.util.flask.restricted_access
    @octoprint.server.admin_permission.require(403)
    def firmware_file(self, *args, **kwargs):
        """Handle firmware file upload."""
        pass

    @octoprint.plugin.BlueprintPlugin.route("/refresh_firmware_info", methods=["POST"])
    @octoprint.server.util.flask.restricted_access
    @octoprint.server.admin_permission.require(403)
    def refresh_firmware_info(self, *args, **kwargs):
        """Refresh firmware information."""
        if not request.json is None and "url" in request.json:
            self._settings.set(["url"], request.json["url"])
        self.xml = None
        return self._firmware_info()

    def _firmware_info(self):
        """Retrieve and parse firmware information."""
        if self.xml is None:
            url = self._settings.get(["url"])
            try:
                self.xml = requests.get(url)
            except:
                self._logger.exception("Unable to retrieve firmware information from {0}".format(url))
                return flask.make_response("Unable to retrieve firmware information from {0}".format(url), 400)
            try:
                self.firmware_info = xmltodict.parse(self.xml.text)
            except:
                self._logger.exception(
                    "Retrieved firmware information from {0}, but was unable to understand the response.".format(url))
                return flask.make_response(
                    "Retrieved firmware information from {0}, but was unable to understand the response.".format(url),
                    400)
        boards = dict()
        for idx, board_xml in enumerate(self.firmware_info["boards"]["board"]):
            if "@name" in board_xml and "firmware" in board_xml:
                board = dict()
                board["name"] = board_xml["@name"]
                board["idx"] = idx
                board["firmwares"] = dict()
                if not isinstance(board_xml["firmware"], list):
                    board_xml["firmware"] = [board_xml["firmware"]]
                for firmware_xml in board_xml["firmware"]:
                    if "@relpath" in firmware_xml and "@description" in firmware_xml and "@name" in firmware_xml:
                        firmware = dict()
                        firmware["relpath"] = firmware_xml["@relpath"]
                        firmware["description"] = firmware_xml["@description"]
                        board["firmwares"][firmware_xml["@name"]] = firmware
                    else:
                        self._logger.info("Skipping firmware %s", repr(firmware_xml))
                boards[board_xml["@name"]] = board
            else:
                self._logger.info("Skipping board %s", repr(board_xml))
        return flask.jsonify(boards)

    # ~~ SettingsPlugin API
    def get_settings_defaults(self, *args, **kwargs):
        return {
            "url": "http://s3.amazonaws.com/sailfish-firmware.polar3d.com/release/firmware.xml",
            "enable_navbar": False,
        }

    # ~~ AssetPlugin API
    def get_assets(self, *args, **kwargs):
        return dict(
            js=["js/flashsailfish.js"],
            css=["css/flashsailfish.css"],
            less=["less/flashsailfish.less"]
        )

    # ~~ Update hook
    def get_update_information(self, *args, **kwargs):
        return dict(
            flashsailfish=dict(
                displayName="Flash Sailfish",
                displayVersion=self._plugin_version,

                # version check: github repository
                type="github_release",
                user="markwal",
                repo="octoflashsailfish",
                current=self._plugin_version,

                # stable releases
                stable_branch=dict(
                    name="Stable",
                    branch="master",
                    comittish=["master"]
                ),

                # release candidates
                prerelease_branches=[
                    dict(
                        name="Release Candidate",
                        branch="rc",
                        comittish=["rc", "master"],
                    ),
                    dict(
                        name="Development",
                        branch="devel",
                        comittish=["devel", "rc", "master"],
                    )
                ],

                # update method: pip
                pip="https://github.com/wesk1/octoflashsailfish/archive/{target_version}.zip"
            )
        )

    def is_blueprint_csrf_protected(self):
        return True


class FlashException(Exception):
    def __init__(self, reason, *args, **kwargs):
        Exception.__init__(self, *args, **kwargs)
        self.reason = reason


__plugin_name__ = "Flash Sailfish"
__plugin_pythoncompat__ = ">=2.7,<4"


def __plugin_load__():
    global __plugin_implementation__
    global __plugin_hooks__

    __plugin_implementation__ = FlashSailfishPlugin()

    __plugin_hooks__ = {
        "octoprint.plugin.softwareupdate.check_config": __plugin_implementation__.get_update_information
    }

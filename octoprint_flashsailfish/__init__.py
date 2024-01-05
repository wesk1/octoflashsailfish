# coding=utf-8
from __future__ import absolute_import

import octoprint.plugin
from octoprint.server.util.flask import restricted_access
from octoprint.server import admin_permission
from octoprint.plugin import BlueprintPlugin

import flask
from flask import request, make_response

import requests
import xmltodict


class FlashSailfishPlugin(octoprint.plugin.SettingsPlugin,
                          octoprint.plugin.AssetPlugin,
                          octoprint.plugin.TemplatePlugin,
                          octoprint.plugin.BlueprintPlugin):

	def __init__(self, *args, **kwargs):
		self.xml = None
		self.firmware_info = None

	# ~~ SettingsPlugin mixin
	@staticmethod
	def get_settings_defaults(*args, **kwargs):
		return dict(
			url="http://s3.amazonaws.com/sailfish-firmware.polar3d.com/release/firmware.xml"
		)

	# ~~ AssetPlugin mixin
	def get_assets(self, *args, **kwargs):
		return dict(
			js=["js/flashsailfish.js"],
			css=["css/flashsailfish.css"],
			less=["less/flashsailfish.less"]
		)

	# ~~ Softwareupdate hook
	def get_update_information(self, *args, **kwargs):
		return dict(
			flashsailfish=dict(
				displayName="Flash Sailfish",
				displayVersion=self._plugin_version,

				# version check: gitHub repository
				type="github_release",
				user="markwal",
				repo="octoflashsailfish",
				current=self._plugin_version,

				# update method: pip
				pip="https://github.com/wesk1/octoflashsailfish/archive/{target_version}.zip"
			)
		)

	# ~~ Blueprint mixin
	@BlueprintPlugin.route("/firmware_file", methods=["POST"])
	@restricted_access
	@admin_permission.require(403)
	def firmware_file(self, *args, **kwargs):
		pass

	@BlueprintPlugin.route("/firmware_info", methods=["GET"])
	@restricted_access
	@admin_permission.require(403)
	def get_firmware_info(self, *args, **kwargs):
		return self._firmware_info()

	@BlueprintPlugin.route("/refresh_firmware_info", methods=["POST"])
	@restricted_access
	@admin_permission.require(403)
	def refresh_firmware_info(self, *args, **kwargs):
		url = request.json.get("url")
		if url:
			self._settings.set(["url"], url)
		self.xml = None
		return self._firmware_info()

	def _firmware_info(self):
		if self.xml is None:
			url = self._settings.get(["url"])
			try:
				self.xml = requests.get(url)
			except requests.exceptions.RequestException as _:
				self._logger.exception("Unable to retrieve firmware information from {0}".format(url))
				return make_response("Unable to retrieve firmware information from {0}".format(url), 400)
			try:
				self.firmware_info = xmltodict.parse(self.xml.text)
			except requests.exceptions.RequestException as _:
				self._logger.exception(
					"Retrieved firmware information from {0}, but was unable to understand the response.".format(url))
				return make_response(
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


__plugin_name__ = "Flash Sailfish"

__plugin_pythoncompat__ = ">=2.7,<4,>=3,<4"  # Updated to support Python 3.9


def __plugin_load__():
	global __plugin_implementation__
	__plugin_implementation__ = FlashSailfishPlugin()

	global __plugin_hooks__
	__plugin_hooks__ = {
		"octoprint.plugin.softwareupdate.check_config": __plugin_implementation__.get_update_information
	}

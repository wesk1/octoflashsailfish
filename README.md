# OctoPrint-FlashSailfish
(INCOMPLETE)

An OctoPrint plugin for updating the Sailfish firmware on your 3d printer.

## Setup

Install manually using this URL:

    https://github.com/wesk1/octoflashsailfish/archive/master.zip

## Instructions

FlashSailfish adds a settings panel to OctoPrint where you can set the firmware
update url: It's currently defaults to
https://s3.amazonaws.com/sailfish-firmware.polar3d.com/release/firmware.xml

To update your firmware, choose the correct printer motherboard and select a
version of Sailfish and click the Flash button.

If your selected motherboard doesn't have the autoreset feature, the settings
panel will prompt you to hit the printer's reset button shortly before clicking
the Update button on the prompt.

## Special note for FlashForge Motherboard

If you have a FlashForge Creator X or a FlashForge motherboard in some other
kind of printer, the plugin can't tell whether you have the autoreset feature
since some do and some don't.  Be careful, if you have the autoreset hardware,
the update will start by itself and if you then hit the reset button you could
corrupt the bootloader and you'll need an ICSP to unbrick your printer.

Most of the recent manufactured FlashForge boards have a working bootloader and
an installed C20 capacitor for autoreset, so I recommend trying to update
without pushing the reset button at all and only after that doesn't seem to work
then try hitting the reset button (only once and shortly *before* you click the
plugin's update button).

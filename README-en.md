# Note Calendar - Obsidian Calendar Plugin

**[English Version](README-en.md) | [中文版本](README.md)**

## Introduction

This is a Obsidian calendar plugin that supports displaying lunar calendar, holidays, work day adjustments, solar terms, and other information. It supports displaying and creating notes associated with the calendar for existing notes updates/creations.

## Features

1. **Calendar Views**：Supports displaying Gregorian calendar, lunar calendar, work day adjustments, solar terms, holidays, and other information. Supports switching between monthly and yearly views.

2. **Note Management**：Supports retrieving note properties, displaying summaries of note updates/creations, and automatically refreshing the notes list. Green dots indicate new notes, and blue dots indicate updated notes.

3. **Note Creation**：Supports creating daily notes, weekly notes, quarterly notes, and yearly notes, with customizable note name formats.

4. **Quick Creation**：Supports creating notes directly in the calendar view, click the buttons in the notes list to create different types of notes.

5. **Responsive Design**：Adapts to different screen sizes, providing a good user experience.

## Plugin Settings

### Basic Settings

- **Week Start Day**：Select whether the first day of the week is Sunday or Monday
- **Weekend Color**：Set the color for Saturday and Sunday display
- **Theme Color**：Set the display color for today, selected state, and holidays
- **Font**：Select the font used for the calendar, supporting default, Microsoft YaHei, SimSun, SimHei, Arial, Helvetica, Verdana, Tahoma, Segoe UI
- **Font Size**：Set the calendar text size (10-20px)

### Display Settings

- **Show Solar Holidays**：Control whether to display solar holiday information
- **Show Work Day Adjustments**：Control whether to display work day adjustment information
- **Show Lunar Date**：Control whether to display lunar date, month, and year
- **Show Lunar Holidays**：Control whether to display lunar holiday information
- **Show Solar Terms**：Control whether to display solar term information

### Note Settings

- **Note Folder Path**：Set the folder path for scanning notes (leave blank for root directory)
- **Date Format**：Set the default date format for new notes, supporting YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, MM/DD/YYYY
- **Rescan Notes**：Click the button to rescan all notes

## Usage

### Basic Operations

1. **Navigate Dates**：Use the arrow buttons at the top of the calendar to navigate to the previous or next month/year.

2. **View Notes**：Click on a date in the calendar to view the notes list for that day.

### Note Creation
1. **Create Daily Note**：Click the "+" button in the notes list, enter the title and folder path in the pop-up dialog, and click confirm to create.

2. **Create Weekly Note**：Click the "周" (Week) button in the notes list, the system will automatically generate a default title in the format "YYYY-n周" (YYYY-nth Week).

3. **Create Quarterly Note**：Click the "季" (Quarter) button in the notes list, the system will automatically generate a default title in the format "YYYY年-n季度" (YYYY-nth Quarter).

4. **Create Yearly Note**：Click the "年" (Year) button in the notes list, the system will automatically generate a default title in the format "YYYY".

### Note Management
- **Auto Refresh**：When creating, modifying, renaming, or deleting notes, the calendar will automatically refresh to display the latest note status.
- **Notes List**：Displays all notes for the currently selected date, click on the note name to open the note directly.

## Installation Guide

### Method 1: Manual Installation
1. **Download Plugin**：Download the latest version of the plugin zip file note-calendar.zip from the [releases page](https://github.com/yourusername/obsidian-note-calendar/releases).

2. **Install Plugin**：Unzip the plugin zip file note-calendar.zip, the unzipped folder name is note-calendar, put it into Obsidian's plugin directory.

3. **Enable Plugin**：Open settings in Obsidian, find the plugin list, and enable the "Note Calendar" plugin.

### Method 2: Install using Obsidian Community Plugin Market (under review, not yet available)

1. **Open Obsidian Community Plugin Market**：Open settings in Obsidian, find the Community Plugin Market.

2. **Search Plugin**：Search for "Note Calendar" plugin in the plugin market.

3. **Install Plugin**：Click the "Install" button in the plugin list to confirm installation.

4. **Enable Plugin**：Open settings in Obsidian, find the plugin list, and enable the "Note Calendar" plugin.

## Feedback
- **Issue Feedback**：If you encounter any problems during use, please submit an issue report in [GitHub Issues](https://github.com/yourusername/obsidian-note-calendar/issues).

- **Feature Suggestions**：If you have any feature suggestions or improvement ideas, please submit suggestions in [GitHub Issues](https://github.com/yourusername/obsidian-note-calendar/issues).

## Dependencies
### 1. lunar Component
lunar is a tool for Gregorian calendar (solar calendar), lunar calendar (lunar calendar, traditional Chinese calendar), Buddhist calendar and Taoist calendar without third-party dependencies.
GitHub URL: https://github.com/6tail/lunar-javascript
Documentation URL: https://6tail.cn/calendar/api.html
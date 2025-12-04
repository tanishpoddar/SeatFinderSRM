<div align="center">

# 🪑 SeatFinderSRM

### *Find Your Perfect Study Spot*

A modern, real-time seat booking system for SRM University libraries, built with Next.js and Firebase.

[![Next.js](https://img.shields.io/badge/Next.js-16.0.7-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12.6-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-GPL%20v3-green?style=for-the-badge)](LICENSE)


</div>


## ✨ Features

### 🔐 **Secure Authentication**
- **SRM-Exclusive Access**: Only `@srmist.edu.in` email addresses allowed
- **Automatic User Sync**: User profiles automatically created in database on first login
- **Secure Firebase Auth**: Industry-standard authentication
- **Admin Access Control**: Configurable admin emails via environment variables

### 🗺️ **Interactive Seat Map**
- **Real-time Updates**: See seat availability instantly across all floors
- **Visual Status Indicators**: 
  - 🟢 Available - Ready to book
  - 🟡 Reserved - Booked but not checked in
  - 🔴 Occupied - Currently in use
  - 🔧 Maintenance - Under repair
  - ⛔ Out of Service - Temporarily unavailable
- **Floor Navigation**: Easy switching between library floors
- **Search & Filter**: Find seats quickly with advanced filters

### ⏱️ **Smart Booking System**
- **Timed Reservations**: Book seats for specific durations
- **Booking Extension**: Extend your booking if needed
- **Anti-Hoarding Protection**: Automatic cancellation of unconfirmed bookings
- **Booking History**: Track all your past and current bookings
- **Usage Statistics**: View your booking patterns and total hours

### 📱 **QR Code Check-in**
- **Unique QR Codes**: Each booking generates a scannable QR code
- **Quick Check-in**: Scan at library entrance to confirm your seat
- **Download QR**: Save QR code for offline access
- **Admin Scanner**: Staff interface for seamless check-in/check-out management

### 💬 **Feedback System**
- **Submit Feedback**: Report issues or suggest improvements
- **Category-based**: Technical, Booking, Seat, Facility, or General feedback
- **Ticket Tracking**: View status of your feedback submissions
- **Admin Responses**: Get replies from library staff

### 📊 **Admin Dashboard**
- **Analytics**: Real-time occupancy rates, peak hours, and usage trends
- **Booking Management**: View, cancel, check-in/out bookings manually
- **User Management**: Search users, flag/unflag accounts
- **Seat Management**: Mark seats for maintenance or out of service
- **Feedback Management**: View and respond to user feedback
- **Reports**: Generate CSV reports with custom date ranges
- **Settings**: Configure library operating hours

### 🔄 **Self-Healing System**
- **Auto-Cleanup**: Expired bookings automatically freed
- **Overstay Detection**: Seats released after booking duration ends
- **Real-time Sync**: All changes reflected instantly across all devices
- **Automatic Expiry**: Unconfirmed bookings cancelled after grace period

### 🎨 **Modern UI/UX**
- **Responsive Design**: Perfect on desktop, tablet, and mobile
- **Dark/Light Mode**: Easy on the eyes, day or night
- **Smooth Animations**: Fluid transitions and interactions
- **Accessible**: Built with accessibility in mind
- **Mobile-First**: Optimized for mobile devices


## 🎯 How It Works

```mermaid
graph LR
    A[Student Login] --> B[Browse Seats]
    B --> C[Book Available Seat]
    C --> D[Receive QR Code]
    D --> E[Scan at Library]
    E --> F[Seat Confirmed]
    F --> G[Study Time!]
    G --> H[Auto Check-out]
```

### 📝 User Flow

1. **Sign Up/Login** with your `@srmist.edu.in` email
2. **Verify Email** via the link sent to your inbox
3. **Browse Seats** on the interactive floor map
4. **Book a Seat** for your desired duration
5. **Get QR Code** instantly after booking
6. **Check In** by scanning QR at library entrance
7. **Study** in your reserved seat
8. **Auto Check-out** when time expires or manually check out


## 📊 System Capacity

- **Concurrent Users**: Supports 1,000+ simultaneous users
- **Daily Bookings**: Handles 2,000-5,000 bookings per day
- **Real-time Updates**: Sub-second latency for seat status changes
- **Uptime**: 99.9% availability with Firebase infrastructure
- **Scalability**: Auto-scales with Firebase Realtime Database

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. 🍴 Fork the repository
2. 🌿 Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. 💾 Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. 📤 Push to the branch (`git push origin feature/AmazingFeature`)
5. 🔃 Open a Pull Request


## 👥 Contributors

<table>
<tr>
<td align="center">
<a href="https://github.com/nidhi-nayana">
<img src="https://github.com/nidhi-nayana.png" width="100px;" alt="Nidhi Nayana"/><br />
<sub><b>Nidhi Nayana</b></sub>
</a>
</td>
<td align="center">
<a href="https://github.com/tanishpoddar">
<img src="https://github.com/tanishpoddar.png" width="100px;" alt="Tanish Poddar"/><br />
<sub><b>Tanish Poddar</b></sub>
</a>
</td>
<td align="center">
<a href="https://github.com/nishant-codess">
<img src="https://github.com/nishant-codess.png" width="100px;" alt="Nishant Ranjan"/><br />
<sub><b>Nishant Ranjan</b></sub>
</a>
</td>
</tr>
</table>


## 📄 License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

<div align="center">

### ⭐ Star us on GitHub — it motivates us a lot!

Made with ❤️ by SRM Students, for SRM Students

[⬆ Back to Top](#-seatfindersrm)

</div>
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend } from 'recharts';
import { DollarSign, Activity, Users, TrendingUp, CreditCard, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const mrrData = [
  { name: 'Jan', mrr: 4000, collected: 2400 },
  { name: 'Feb', mrr: 3000, collected: 1398 },
  { name: 'Mar', mrr: 2000, collected: 9800 },
  { name: 'Apr', mrr: 2780, collected: 3908 },
  { name: 'May', mrr: 1890, collected: 4800 },
  { name: 'Jun', mrr: 2390, collected: 3800 },
  { name: 'Jul', mrr: 3490, collected: 4300 },
];

const churnData = [
  { name: 'Jan', rate: 2.1 },
  { name: 'Feb', rate: 1.8 },
  { name: 'Mar', rate: 2.4 },
  { name: 'Apr', rate: 1.2 },
  { name: 'May', rate: 1.5 },
  { name: 'Jun', rate: 0.9 },
  { name: 'Jul', rate: 1.1 },
];

export default function BillingOverview() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-background min-h-screen">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Billing Overview</h1>
        <p className="text-muted-foreground">Monitor revenue, collection rates, and active subscriptions.</p>
      </div>

      <motion.div 
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden relative group border-none bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent shadow-sm hover:shadow-md transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Total Revenue (MRR)</CardTitle>
              <div className="h-8 w-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-indigo-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$45,231.89</div>
              <p className="text-xs text-emerald-500 font-medium flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                +20.1% from last month
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-none bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Users className="h-4 w-4 text-emerald-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">+2350</div>
              <p className="text-xs text-emerald-500 font-medium flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                +180 new this month
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-none bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
              <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">92.4%</div>
              <p className="text-xs text-emerald-500 font-medium flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                +2.4% from last month
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-none bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-transparent shadow-sm hover:shadow-md transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Overdue Balances</CardTitle>
              <div className="h-8 w-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-rose-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600">$4,231.00</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across 142 invoices
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <motion.div 
          className="col-span-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Card className="shadow-sm border-border/50 h-full">
            <CardHeader>
              <CardTitle>Revenue vs Collections</CardTitle>
              <CardDescription>Monthly recurring revenue compared to actual collected amounts.</CardDescription>
            </CardHeader>
            <CardContent className="pl-0">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mrrData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="mrr" name="MRR" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorMrr)" />
                    <Area type="monotone" dataKey="collected" name="Collected" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCollected)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          className="col-span-3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Card className="shadow-sm border-border/50 h-full">
            <CardHeader>
              <CardTitle>Subscriber Churn Rate</CardTitle>
              <CardDescription>Monthly percentage of canceled or unpaid subscriptions.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={churnData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value) => [`${value}%`, 'Churn Rate']}
                    />
                    <Line type="monotone" dataKey="rate" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

'use client';
import React from 'react';
import Icon from './Icon';
export type LkvIconName = 'home'|'mountain'|'bag'|'doc'|'user'|'search'|'chevron-left'|'chevron-right'|'heart'|'bookmark'|'bell'|'map-pin'|'star'|'minus'|'plus'|'close'|'menu'|'arrow-right'|'arrow-left'|'lock'|'filter'|'users'|'compass'|'box'|'sparkles'|'tent'|'book';
export interface LkvIconProps {name:LkvIconName;size?:number;color?:string;className?:string;style?:React.CSSProperties;}
/** Existing LkvIcon call sites now render the official organic monochrome LKDV SVGs. */
export default function LkvIcon({name,size=20,color,className='',style}:LkvIconProps){return <Icon name={name} source="auto" size={size} color={color} className={className} style={style}/>;}
